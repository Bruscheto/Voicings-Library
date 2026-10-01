/**
 * Chord → voicings. A query names a chord; every stored shape with a reading
 * of that chord is returned, transposed to the queried root near the register
 * it was authored in. One captured shape answers the query in all 12 keys.
 */

import { chordSymbol, rootName, spellPc } from './spelling';
import { detectChord } from './detect';
import { mod12, normalizeNotes, type PitchClass } from './pitch';
import type { BaseQuality } from './qualities';
import { toShape } from './shape';
import { parseSymbol } from './symbol';
import type { StoredReading, StoredVoicing } from './voicing';

export type LibraryVoicing = StoredVoicing & {
  id: string;
  name: string | null;
  structure: string[];
};

export type ChordQuery = {
  rootPc: PitchClass;
  quality: BaseQuality;
  tensions: string[];
  /** Only voicings with this note in the bass; null for any. */
  bassPc: PitchClass | null;
  /** "7alt": any dominant whose tensions are all altered. */
  altered: boolean;
};

/** exact: same tensions. extended: adds tensions to the ones asked for. */
export type MatchKind = 'exact' | 'extended';

export type FinderResult = {
  voicing: LibraryVoicing;
  reading: StoredReading;
  midi: number[];
  symbol: string;
  match: MatchKind;
};

const ALTERED = new Set(['b9', '#9', '#11', 'b13']);
const HALF_OCTAVE = 6;

export function queryFromSymbol(symbol: string): ChordQuery {
  const { rootPc, quality, tensions, bassPc, altered } = parseSymbol(symbol);
  return { rootPc, quality, tensions, bassPc, altered };
}

/** The engine's reading of played notes, ignoring which note is in the bass. */
export function queryFromNotes(midi: readonly number[]): ChordQuery | null {
  const [top] = detectChord(midi).readings;
  if (!top) return null;
  return {
    rootPc: top.rootPc,
    quality: top.quality,
    tensions: top.tensions,
    bassPc: null,
    altered: false,
  };
}

export function querySymbol(query: ChordQuery): string {
  if (query.altered) {
    const spelling = { rootPc: query.rootPc, quality: query.quality };
    const slash = query.bassPc === null ? '' : `/${spellPc(query.bassPc, spelling)}`;
    return `${rootName(spelling)}7alt${slash}`;
  }
  return chordSymbol(query.rootPc, query.quality, query.tensions, query.bassPc);
}

function matchKind(reading: StoredReading, query: ChordQuery): MatchKind | null {
  if (reading.quality !== query.quality) return null;
  if (query.bassPc !== null && mod12(query.rootPc - query.bassPc) !== reading.rootOffset)
    return null;
  if (query.altered) {
    return reading.tensions.length > 0 && reading.tensions.every((t) => ALTERED.has(t))
      ? 'exact'
      : null;
  }
  if (!query.tensions.every((t) => reading.tensions.includes(t))) return null;
  return reading.tensions.length === query.tensions.length ? 'exact' : 'extended';
}

/** The bass of a shape moved to a new pitch class, staying within a tritone of where it was authored. */
export function nearestBass(authoredBass: number, bassPc: PitchClass): number {
  let delta = mod12(bassPc - authoredBass);
  if (delta > HALF_OCTAVE) delta -= 12;
  return authoredBass + delta;
}

export function readingSymbol(reading: StoredReading, rootPc: PitchClass): string {
  return chordSymbol(rootPc, reading.quality, reading.tensions, mod12(rootPc - reading.rootOffset));
}

export function findVoicings(
  library: readonly LibraryVoicing[],
  query: ChordQuery,
): FinderResult[] {
  const results: FinderResult[] = [];
  for (const voicing of library) {
    let best: { reading: StoredReading; match: MatchKind } | null = null;
    for (const reading of voicing.readings) {
      const match = matchKind(reading, query);
      if (match && (!best || (best.match === 'extended' && match === 'exact')))
        best = { reading, match };
    }
    if (!best) continue;
    const bass = nearestBass(voicing.bassMidi, query.rootPc - best.reading.rootOffset);
    results.push({
      voicing,
      reading: best.reading,
      midi: voicing.intervals.map((i) => bass + i),
      symbol: readingSymbol(best.reading, query.rootPc),
      match: best.match,
    });
  }
  return results.sort(
    (a, b) =>
      Number(a.match === 'extended') - Number(b.match === 'extended') ||
      a.reading.tensions.length - b.reading.tensions.length ||
      a.voicing.intervals.length - b.voicing.intervals.length ||
      (a.voicing.name ?? '').localeCompare(b.voicing.name ?? ''),
  );
}

/** The stored voicing with exactly this shape, in any key. */
export function findShape(
  library: readonly LibraryVoicing[],
  midi: readonly number[],
): LibraryVoicing | null {
  const notes = normalizeNotes(midi);
  if (notes.length < 2) return null;
  const { shapeKey } = toShape(notes);
  return library.find((v) => v.intervals.join('-') === shapeKey) ?? null;
}
