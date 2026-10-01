import { NextResponse } from 'next/server';
import { prisma } from 'data-model';
import { authorizeAdmin } from '../../../lib/auth';

const COLLECTION_TAG_PREFIX = 'collection:';

export type LibraryShape = {
  id: string;
  name: string | null;
  intervals: number[];
  bassMidi: number;
  readings: {
    rootOffset: number;
    quality: string;
    tensions: string[];
    rootless: boolean;
    isPrimary: boolean;
  }[];
};

export type LibrarySnapshot = {
  shapes: Record<string, LibraryShape>;
  collections: string[];
};

// What the capture page needs to warn about duplicates in any key and to
// offer existing collections. Small by design: shapes, not rendered voicings.
export async function GET(request: Request) {
  const denied = await authorizeAdmin(request);
  if (denied) return denied;

  try {
    const [voicings, tags] = await Promise.all([
      prisma.voicing.findMany({
        select: {
          id: true,
          name: true,
          intervals: true,
          bassMidi: true,
          shapeKey: true,
          readings: {
            select: {
              rootOffset: true,
              quality: true,
              tensions: true,
              rootless: true,
              isPrimary: true,
            },
          },
        },
      }),
      prisma.tag.findMany({
        where: { name: { startsWith: COLLECTION_TAG_PREFIX } },
        orderBy: { name: 'asc' },
      }),
    ]);
    const snapshot: LibrarySnapshot = {
      shapes: Object.fromEntries(voicings.map(({ shapeKey, ...shape }) => [shapeKey, shape])),
      collections: tags.map((tag) => tag.name.slice(COLLECTION_TAG_PREFIX.length)),
    };
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Failed to load library:', error);
    return NextResponse.json({ error: 'Failed to load library' }, { status: 500 });
  }
}
