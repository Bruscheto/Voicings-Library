import { Prisma } from 'data-model';
import { parseSymbol } from 'harmony';

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

// A typed chord symbol matches readings by quality and tensions in any key:
// voicings are shapes, so "Gm9" finds every min7 + 9 voicing.
function symbolReading(value: string): Prisma.VoicingReadingWhereInput | null {
  try {
    const parsed = parseSymbol(value);
    return { quality: parsed.quality, tensions: { equals: parsed.tensions } };
  } catch {
    return null;
  }
}

export function normalizeVoicingFilters(params: VoicingFilterParams): NormalizedVoicingFilters {
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
    const search: Prisma.VoicingWhereInput[] = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { structure: { has: filters.q.toLowerCase() } },
    ];
    const reading = symbolReading(filters.q);
    if (reading) search.push({ readings: { some: reading } });
    where.push({ OR: search });
  }

  if (filters.quality) {
    where.push({ readings: { some: { quality: filters.quality } } });
  }

  for (const name of filters.tags) {
    where.push({ tags: { some: { tag: { name } } } });
  }

  if (filters.noTensions) {
    where.push({ readings: { some: { tensions: { isEmpty: true } } } });
  } else if (filters.tensions.length > 0) {
    where.push({ readings: { some: { tensions: { hasEvery: filters.tensions } } } });
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
