import { Prisma } from 'data-model';

export type VoicingFilterParams = {
  q?: string;
  quality?: string;
  tag?: string | string[];
  tension?: string | string[];
  tensionMode?: string;
};

export type NormalizedVoicingFilters = {
  q: string;
  quality: string;
  tags: string[];
  tensions: string[];
  noTensions: boolean;
};

function toArrayParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeList(value: string | string[] | undefined): string[] {
  return Array.from(
    new Set(
      toArrayParam(value)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizePitchSearch(value: string): string | null {
  const match = value.trim().match(/^([a-gA-G])([#b]?)(-?\d)$/);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2]}${match[3]}`;
}

export function normalizeVoicingFilters(
  params: VoicingFilterParams,
): NormalizedVoicingFilters {
  return {
    q: params.q?.trim() ?? '',
    quality: params.quality?.trim() ?? '',
    tags: normalizeList(params.tag),
    tensions: normalizeList(params.tension),
    noTensions: params.tensionMode === 'none',
  };
}

export function buildVoicingWhere(params: VoicingFilterParams): Prisma.VoicingWhereInput {
  const filters = normalizeVoicingFilters(params);
  const where: Prisma.VoicingWhereInput[] = [];

  if (filters.q) {
    const pitch = normalizePitchSearch(filters.q);
    const search: Prisma.VoicingWhereInput[] = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      {
        chords: {
          some: {
            chord: {
              OR: [
                { symbol: { contains: filters.q, mode: 'insensitive' } },
                { root: { equals: filters.q, mode: 'insensitive' } },
                { quality: { equals: filters.q, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ];

    if (pitch) {
      search.push({ pitches: { has: pitch } });
    }

    where.push({ OR: search });
  }

  if (filters.quality) {
    where.push({
      chords: {
        some: { chord: { quality: { equals: filters.quality, mode: 'insensitive' } } },
      },
    });
  }

  for (const name of filters.tags) {
    where.push({ tags: { some: { tag: { name } } } });
  }

  if (filters.noTensions) {
    where.push({
      chords: {
        some: { chord: { tensions: { isEmpty: true } } },
      },
    });
  } else if (filters.tensions.length > 0) {
    where.push({
      chords: {
        some: { chord: { tensions: { hasEvery: filters.tensions } } },
      },
    });
  }

  return where.length ? { AND: where } : {};
}

export function hasActiveVoicingFilters(params: VoicingFilterParams): boolean {
  const filters = normalizeVoicingFilters(params);
  return Boolean(
    filters.q ||
      filters.quality ||
      filters.tags.length > 0 ||
      filters.tensions.length > 0 ||
      filters.noTensions,
  );
}
