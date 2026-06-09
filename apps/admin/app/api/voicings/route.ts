import { NextResponse } from 'next/server';
import { prisma, toBase, canonicalizeChord, buildSymbol } from 'data-model';

type SaveBody = {
  root: string;
  quality: string;
  tensions: string[];
  voicingName: string | null;
  pitches: string[];
  slashBass: string | null;
  contextTags: string[];
  collections: string[];
};

const COLLECTION_TAG_PREFIX = 'collection:';

const cleanNames = (value: unknown) => (
  Array.isArray(value)
    ? Array.from(new Set(value.map(String).map(name => name.trim()).filter(Boolean)))
    : []
);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SaveBody>;
    const {
      root,
      quality,
      tensions,
      voicingName,
      pitches,
      slashBass,
      contextTags,
      collections,
    } = body;

    if (!root || !quality || !Array.isArray(pitches)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const rawTensions = Array.isArray(tensions) ? tensions : [];
    const base = toBase(quality, rawTensions);
    const display = canonicalizeChord(quality, rawTensions);
    const displaySymbol = buildSymbol(root, display.quality, display.tensions, slashBass ?? null);

    // 1. Upsert Chord by display symbol; STORE base quality + full tensions.
    const chord = await prisma.chord.upsert({
      where: { symbol: displaySymbol },
      update: {},
      create: {
        symbol: displaySymbol,
        root,
        quality: base.quality,
        tensions: base.tensions,
      },
    });

    const normalizedSlashBass = slashBass ?? null;
    const normalizedName = (voicingName ?? '').trim() || null;
    const collectionTagNames = cleanNames(collections).map(
      (name) => `${COLLECTION_TAG_PREFIX}${name}`,
    );
    const contextTagNames = cleanNames(contextTags);

    const resolveTagIds = (names: string[]) =>
      Promise.all(
        names.map(async (name) => {
          const tag = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          return tag.id;
        }),
      );

    // A voicing's identity is (chord, pitches, slashBass, name). Collections are
    // memberships layered on top via `collection:` tags — NOT part of identity.
    // So the same notes under a different name are different voicings, while the
    // same voicing saved to a new collection just gains that membership instead
    // of producing a duplicate row or being rejected outright.
    const existing = await prisma.voicing.findFirst({
      where: {
        name: normalizedName,
        pitches: { equals: pitches },
        slashBass: normalizedSlashBass,
        chords: { some: { chordId: chord.id } },
      },
      include: { tags: { include: { tag: true } } },
    });

    if (existing) {
      const existingTagNames = new Set(existing.tags.map((vt) => vt.tag.name));
      const tagsToAdd = [...collectionTagNames, ...contextTagNames].filter(
        (name) => !existingTagNames.has(name),
      );

      // Already a member of every selected collection (nothing new to add).
      if (tagsToAdd.length === 0) {
        return NextResponse.json(
          { success: false, error: 'This voicing already exists in the selected collection' },
          { status: 409 },
        );
      }

      const tagIds = await resolveTagIds(tagsToAdd);
      await prisma.voicingTag.createMany({
        data: tagIds.map((tagId) => ({ voicingId: existing.id, tagId })),
        skipDuplicates: true,
      });

      return NextResponse.json({
        success: true,
        voicing: { id: existing.id },
        canonicalSymbol: displaySymbol,
      });
    }

    // New voicing — create with chord link + tag joins.
    const tagIds = await resolveTagIds([...contextTagNames, ...collectionTagNames]);
    const voicing = await prisma.voicing.create({
      data: {
        name: normalizedName,
        pitches,
        slashBass: normalizedSlashBass,
        chords: {
          create: { chordId: chord.id },
        },
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });

    return NextResponse.json({ success: true, voicing, canonicalSymbol: displaySymbol });
  } catch (error) {
    console.error('Failed to save voicing:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
