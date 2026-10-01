/**
 * Notes → ranked chord readings.
 *
 * Two steps, adapted from Woodshed's template matcher (theory/chords.py):
 *   1. Skeleton: for every root × base quality whose essential tones all
 *      sound, score the match. The root may be absent on seventh chords
 *      (rootless voicings), never on triads.
 *   2. Residual: every other pitch class must be a legal tension over that
 *      skeleton (#9 vs b3, #11 vs b5), or the reading is rejected.
 *
 * Readings that canonicalize to the same chord are merged, so C·E·G·A reads
 * once as C6 rather than also as C(add13).
 */

import { toBase } from './canonicalize';
import { logPrior } from './commonness';
import { chordSymbol, rootName, spellPc } from './spelling';
import { mod12, normalizeNotes, type PitchClass } from './pitch';
import {
  BASE_QUALITIES,
  QUALITIES,
  familyOf,
  hasSeventh,
  isBaseQuality,
  type BaseQuality,
  type Family,
} from './qualities';

export type Reading = {
  rootPc: PitchClass;
  root: string;
  /** Base (storage) quality. */
  quality: BaseQuality;
  /** Full tension set in storage order. */
  tensions: string[];
  bassPc: PitchClass;
  bass: string;
  rootless: boolean;
  family: Family;
  /** Display symbol, e.g. "Cmaj9/E" style via buildSymbol. */
  symbol: string;
  /** How well the notes fit this reading (heuristic, unbounded). */
  score: number;
  /** Share of all readings of these notes, after weighing how common the name is. */
  probability: number;
};

export type Detection = {
  readings: Reading[];
  /** True when no reading is clearly the most likely without context. */
  ambiguous: boolean;
};

const SCORE = {
  guideTone: 2,
  chordTone: 1,
  rootPresent: 2,
  completeRootless: 2,
  tension: -0.5,
  avoid: -1.5,
  missingFifth: -1,
  // Three notes without a fifth read better as the complete triad they spell
  // (Eb·G·C is Cm/Eb, not Eb6 without its fifth).
  thinVoicing: -2,
  bassIsRoot: 1.5,
  bassIsChordTone: 0.5,
  bassIsTension: -2,
} as const;

// Ranking is score + PRIOR_WEIGHT * prior; probabilities are its softmax at
// TEMPERATURE. Grid-searched on the author-labelled seed and on the intended
// chords of the Woodshed fixtures (see agreement.test.ts): the weight and the
// thin-rootless penalty for top-1 agreement, the temperature for the
// likelihood of the intended reading.
const PRIOR_WEIGHT = 0.75;
const TEMPERATURE = 1;
// Three pitch classes without their root read as a triad, not a rootless
// seventh chord (C·E·G is C, not Am7/C).
const THIN_ROOTLESS = -4;
const ROOTLESS_MIN_PCS = 4;
// Rootless minor-6 and minor-major are played, but far less than the rootless
// dominant sharing their shape (B·E·F·A is G13 before Dm6/9).
const RARE_ROOTLESS = -2;
// Below this top probability the notes need context to name.
const CONFIDENT = 0.7;
const OCTAVE = 12;
const AUGMENTED_FIFTH = 8;
// A major 7th in the bass makes a b9 against the root above it.
const MAJOR_SEVENTH = 11;
const MIN_NOTES = 2;
const THIN_SIZE = 3;
const DEFAULT_LIMIT = 5;
// Tensions that make a rootless seventh chord a complete, playable voicing.
const ROOTLESS_COLOR = new Set(['9', '13']);
// Qualities a pianist actually plays rootless. Minor-6 and minor-major are
// played rootless only with their 9th (Eb·A·D·G as Cm6/9); without it an
// absent root produces spurious readings.
const ROOTLESS_QUALITIES = new Set<BaseQuality>(['Maj7', '6', 'min7', '7', 'm7b5']);
const ROOTLESS_WITH_NINTH = new Set<BaseQuality>(['m6', 'mMaj7']);

type Candidate = Omit<Reading, 'probability'> & { priority: number; rank: number };

function scoreReading(
  rootPc: number,
  quality: BaseQuality,
  notes: readonly number[],
  rootlessQualities: ReadonlySet<BaseQuality> = ROOTLESS_QUALITIES,
): Candidate | null {
  const def = QUALITIES[quality];
  const bassPc = mod12(notes[0]);
  const present = new Set(notes.map((n) => mod12(n - rootPc)));
  if (!def.essential.every((i) => present.has(i))) return null;
  if (def.family === 'aug' && !hasCloseSharpFive(notes, rootPc)) return null;

  const rootPresent = present.has(0);
  const rootlessWithNinth = ROOTLESS_WITH_NINTH.has(quality) && present.has(2);
  if (!rootPresent && !rootlessQualities.has(quality) && !rootlessWithNinth) return null;

  const tensions: string[] = [];
  let score = 0;
  for (const interval of present) {
    const tone = def.tones[interval];
    if (tone) {
      score += tone.role === 'third' || tone.role === 'seventh' ? SCORE.guideTone : SCORE.chordTone;
      continue;
    }
    const tension = def.tensions[interval];
    if (!tension) return null;
    tensions.push(tension);
    score += SCORE.tension + (def.avoid.includes(tension) ? SCORE.avoid : 0);
  }

  if (rootPresent) {
    score += SCORE.rootPresent;
    const fifth = Object.entries(def.tones).find(([, tone]) => tone.role === 'fifth');
    if (fifth && !present.has(Number(fifth[0]))) {
      score += SCORE.missingFifth + (present.size === THIN_SIZE ? SCORE.thinVoicing : 0);
    }
  } else if (tensions.some((t) => ROOTLESS_COLOR.has(t))) {
    score += SCORE.completeRootless;
  }

  const bassInterval = mod12(bassPc - rootPc);
  if (bassInterval === 0) score += SCORE.bassIsRoot;
  else if (def.tones[bassInterval] && bassInterval !== MAJOR_SEVENTH)
    score += SCORE.bassIsChordTone;
  else score += SCORE.bassIsTension;

  const base = toBase(quality, tensions);
  // toBase only folds within the base vocabulary (Maj + 13 → 6).
  const folded = isBaseQuality(base.quality) ? base.quality : quality;
  // Folding can leave a tension the new quality does not allow (min + b13 + 13
  // → m6 + b13); such a reading has no honest name.
  const legal = new Set(Object.values(QUALITIES[folded].tensions));
  if (!base.tensions.every((t) => legal.has(t))) return null;
  const spelling = { rootPc, quality: folded, tensions: base.tensions };
  const root = rootName(spelling);
  const bass = spellPc(bassPc, spelling);
  return {
    rootPc,
    root,
    quality: folded,
    tensions: base.tensions,
    bassPc,
    bass,
    rootless: !rootPresent,
    family: familyOf(folded, base.tensions),
    symbol: chordSymbol(rootPc, folded, base.tensions, bassPc),
    score,
    priority: BASE_QUALITIES.indexOf(folded),
    rank:
      score +
      PRIOR_WEIGHT *
        (logPrior(folded, base.tensions) +
          (!rootPresent && present.size < ROOTLESS_MIN_PCS ? THIN_ROOTLESS : 0) +
          (!rootPresent && ROOTLESS_WITH_NINTH.has(folded) ? RARE_ROOTLESS : 0)),
  };
}

/**
 * A note a minor 6th above the root is the #5 only when voiced within an
 * octave of the bass; higher up it is the b13 of a plain dominant
 * (G·B·D#·F is G7#5, but C·E·Bb·Db·Ab is C7b9b13).
 */
function hasCloseSharpFive(notes: readonly number[], rootPc: number): boolean {
  return notes.some((n) => mod12(n - rootPc) === AUGMENTED_FIFTH && n - notes[0] < OCTAVE);
}

function compare(a: Candidate, b: Candidate): number {
  return (
    b.rank - a.rank ||
    Number(b.rootPc === b.bassPc) - Number(a.rootPc === a.bassPc) ||
    a.tensions.length - b.tensions.length ||
    a.priority - b.priority ||
    a.rootPc - b.rootPc
  );
}

/** Rank every plausible reading of a set of MIDI notes. */
export function detectChord(midi: readonly number[], limit = DEFAULT_LIMIT): Detection {
  const notes = normalizeNotes(midi);
  if (new Set(notes.map(mod12)).size < MIN_NOTES) return { readings: [], ambiguous: false };

  const best = new Map<string, Candidate>();
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const quality of BASE_QUALITIES) {
      const candidate = scoreReading(rootPc, quality, notes);
      if (!candidate) continue;
      const key = `${rootPc}:${candidate.quality}:${candidate.tensions.join(',')}`;
      const existing = best.get(key);
      if (!existing || compare(candidate, existing) < 0) best.set(key, candidate);
    }
  }

  const ranked = Array.from(best.values()).sort(compare);
  const probabilities = softmax(ranked.map((c) => c.rank / TEMPERATURE));
  const readings = ranked
    .slice(0, limit)
    .map((candidate, i) => toReading(candidate, probabilities[i]));
  const ambiguous = ranked.length > 1 && probabilities[0] < CONFIDENT;
  return { readings, ambiguous };
}

const PERCENT = 100;

/** "74%", or "<1%" for a reading the notes barely support. */
export function formatProbability(probability: number): string {
  const percent = Math.round(probability * PERCENT);
  return percent < 1 ? '<1%' : `${percent}%`;
}

function softmax(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

function toReading(
  { priority: _priority, rank: _rank, ...reading }: Candidate,
  probability: number,
): Reading {
  return { ...reading, probability };
}

const ANY_ROOTLESS = new Set<BaseQuality>(BASE_QUALITIES.filter(hasSeventh));

/**
 * Read the notes as one specific root and quality, or null when they cannot
 * support it (an essential tone is missing or a note has no legal name).
 * Unlike detectChord this accepts any rootless seventh chord the author names.
 */
export function readAs(
  midi: readonly number[],
  rootPc: PitchClass,
  quality: BaseQuality,
): Reading | null {
  const notes = normalizeNotes(midi);
  if (notes.length === 0) return null;
  const candidate = scoreReading(mod12(rootPc), quality, notes, ANY_ROOTLESS);
  if (!candidate) return null;
  // Probability is relative to the other readings of the notes.
  const match = detectChord(notes, Infinity).readings.find(
    (r) => r.rootPc === candidate.rootPc && r.quality === candidate.quality,
  );
  return toReading(candidate, match?.probability ?? 0);
}
