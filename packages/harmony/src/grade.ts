/**
 * Grade a played chord against a target by function, not by exact notes:
 * any voicing that carries the guide tones and no clashing note is correct.
 * Woodshed's drills grade exact pitch classes and have to special-case valid
 * alternative shapes; grading by function makes that unnecessary.
 */

import { degreesOf, guideTones, type ChordRef } from './degrees';
import { mod12, normalizeNotes, type PitchClass } from './pitch';
import { QUALITIES } from './qualities';

export type Outcome = 'correct' | 'close' | 'incorrect' | 'insufficient';

export type Grade = {
  outcome: Outcome;
  /** Guide-tone pitch classes the attempt did not sound. */
  missingGuideTones: PitchClass[];
  /** Played notes with no legal name over the chord, or an avoid tension. */
  clashes: number[];
};

const MIN_NOTES = 2;

export function gradeAttempt(midi: readonly number[], target: ChordRef): Grade {
  const notes = normalizeNotes(midi);
  if (new Set(notes.map(mod12)).size < MIN_NOTES) {
    return { outcome: 'insufficient', missingGuideTones: [], clashes: [] };
  }
  const played = new Set(notes.map(mod12));
  const missingGuideTones = guideTones(target).filter((pc) => !played.has(pc));
  const avoid = new Set(QUALITIES[target.quality].avoid);
  const clashes = degreesOf(notes, target)
    .filter((d) => d.label === '?' || avoid.has(d.label))
    .map((d) => d.midi);
  const outcome: Outcome = missingGuideTones.length
    ? 'incorrect'
    : clashes.length
      ? 'close'
      : 'correct';
  return { outcome, missingGuideTones, clashes };
}

/** Memorisation mode: the attempt must sound exactly the target's pitch classes. */
export function gradeExact(midi: readonly number[], target: readonly number[]): Grade {
  const notes = normalizeNotes(midi);
  if (notes.length < MIN_NOTES)
    return { outcome: 'insufficient', missingGuideTones: [], clashes: [] };
  const want = new Set(target.map(mod12));
  const got = new Set(notes.map(mod12));
  const missing = Array.from(want).filter((pc) => !got.has(pc));
  const clashes = notes.filter((n) => !want.has(mod12(n)));
  return {
    outcome: missing.length || clashes.length ? 'incorrect' : 'correct',
    missingGuideTones: missing,
    clashes,
  };
}
