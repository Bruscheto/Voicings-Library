import { NextResponse } from 'next/server';
import { prisma, buildSymbol, analyzeVoicing, VoicingAnalysisError } from 'data-model';
import { pitchToMidi } from 'harmony';

// `symbols` is the play-first form: readings to keep, first one primary, none
// for the engine's reading. root/quality/tensions/slashBass is the current
// capture page's form and becomes a single symbol.
type SaveBody = {
  pitches: string[];
  symbols?: string[];
  root?: string;
  quality?: string;
  tensions?: string[];
  slashBass?: string | null;
  voicingName?: string | null;
  contextTags?: string[];
  collections?: string[];
};

const COLLECTION_TAG_PREFIX = 'collection:';

const cleanNames = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map(String)
            .map((name) => name.trim())
            .filter(Boolean),
        ),
      )
    : [];

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

function authoredSymbols(body: Partial<SaveBody>): string[] {
  if (body.symbols !== undefined) return cleanNames(body.symbols);
  if (!body.root || !body.quality) return [];
  const tensions = isStringArray(body.tensions) ? body.tensions : [];
  return [buildSymbol(body.root, body.quality, tensions, body.slashBass ?? null)];
}

const resolveTagIds = (names: string[]) =>
  Promise.all(
    names.map(async (name) => {
      const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
      return tag.id;
    }),
  );

export async function POST(request: Request) {
  let body: Partial<SaveBody>;
  try {
    body = (await request.json()) as Partial<SaveBody>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isStringArray(body.pitches) || body.pitches.length === 0) {
    return NextResponse.json({ success: false, error: 'Missing pitches' }, { status: 400 });
  }

  let analysis;
  try {
    analysis = analyzeVoicing(body.pitches.map(pitchToMidi), authoredSymbols(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid voicing';
    const status = error instanceof VoicingAnalysisError ? 422 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }

  try {
    const { shape, structure, readings } = analysis;
    const name = (body.voicingName ?? '').trim() || null;
    const tagNames = [
      ...cleanNames(body.contextTags),
      ...cleanNames(body.collections).map((n) => `${COLLECTION_TAG_PREFIX}${n}`),
    ];

    // A voicing's identity is its shape, in any key. Saving an existing shape
    // adds whatever is new — readings, tags, collection memberships — and is
    // only rejected when there is nothing new to add.
    const existing = await prisma.voicing.findUnique({
      where: { shapeKey: shape.shapeKey },
      include: { readings: true, tags: { include: { tag: true } } },
    });

    if (existing) {
      const known = new Set(existing.readings.map((r) => `${r.rootOffset}:${r.quality}`));
      const newReadings = readings.filter((r) => !known.has(`${r.rootOffset}:${r.quality}`));
      const existingTags = new Set(existing.tags.map((vt) => vt.tag.name));
      const newTags = tagNames.filter((n) => !existingTags.has(n));
      if (newReadings.length === 0 && newTags.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'This voicing is already saved with these readings and collections',
          },
          { status: 409 },
        );
      }
      const tagIds = await resolveTagIds(newTags);
      await prisma.$transaction([
        prisma.voicingReading.createMany({
          data: newReadings.map((r) => ({ ...r, voicingId: existing.id, isPrimary: false })),
        }),
        prisma.voicingTag.createMany({
          data: tagIds.map((tagId) => ({ voicingId: existing.id, tagId })),
          skipDuplicates: true,
        }),
        ...(existing.name === null && name
          ? [prisma.voicing.update({ where: { id: existing.id }, data: { name } })]
          : []),
      ]);
      return NextResponse.json({
        success: true,
        voicing: { id: existing.id },
        added: { readings: newReadings.length, tags: newTags.length },
      });
    }

    const tagIds = await resolveTagIds(tagNames);
    const voicing = await prisma.voicing.create({
      data: {
        name,
        intervals: shape.intervals,
        bassMidi: shape.bassMidi,
        shapeKey: shape.shapeKey,
        structure,
        readings: { create: readings },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    return NextResponse.json({ success: true, voicing: { id: voicing.id } });
  } catch (error) {
    console.error('Failed to save voicing:', error);
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 });
  }
}
