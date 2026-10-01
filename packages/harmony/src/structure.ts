/**
 * Voicing structure tags, derived from the notes and the primary reading.
 * Rules are deliberately narrow: a tag should be one a teacher would agree
 * with on sight. Several can apply (So What is quartal and open).
 */

import { degreesOf, type ChordRef } from './degrees';
import { mod12, normalizeNotes } from './pitch';

export type Structure =
  | 'shell'
  | 'rootless-a'
  | 'rootless-b'
  | 'quartal'
  | 'ust'
  | 'drop2'
  | 'drop3'
  | 'close'
  | 'open';

const OCTAVE = 12;
const FOURTH = 5;
const TRITONE = 6;
const ROOTLESS_SIZE = 4;
const DROP_SIZE = 4;
const MIN_QUARTAL_RUN = 2;

export function classifyStructure(midi: readonly number[], chord: ChordRef): Structure[] {
  const notes = normalizeNotes(midi);
  if (notes.length < 2) return [];
  const tags: Structure[] = [];
  if (isShell(notes, chord)) tags.push('shell');
  const rootless = rootlessForm(notes, chord);
  if (rootless) tags.push(rootless);
  if (isQuartal(notes)) tags.push('quartal');
  if (isUpperStructure(notes, chord)) tags.push('ust');
  const drop = dropForm(notes);
  if (drop) tags.push(drop);
  tags.push(notes[notes.length - 1] - notes[0] <= OCTAVE ? 'close' : 'open');
  return tags;
}

function isShell(notes: number[], chord: ChordRef): boolean {
  if (notes.length > 3) return false;
  const roles = new Set(degreesOf(notes, chord).map((d) => d.role));
  return roles.has('third') && roles.has('seventh') && !roles.has('fifth') && !roles.has('tension');
}

function rootlessForm(notes: number[], chord: ChordRef): Structure | null {
  if (notes.length !== ROOTLESS_SIZE) return null;
  const degrees = degreesOf(notes, chord);
  if (degrees.some((d) => d.role === 'root')) return null;
  const roles = new Set(degrees.map((d) => d.role));
  if (!roles.has('third') || !roles.has('seventh')) return null;
  if (degrees[0].role === 'third') return 'rootless-a';
  if (degrees[0].role === 'seventh') return 'rootless-b';
  return null;
}

/** A stack of fourths (one tritone allowed) spanning all but at most one note. */
function isQuartal(notes: number[]): boolean {
  let best = 0;
  let run = 0;
  let tritones = 0;
  for (let i = 1; i < notes.length; i++) {
    const step = notes[i] - notes[i - 1];
    if (step === FOURTH || (step === TRITONE && tritones === 0)) {
      run += 1;
      if (step === TRITONE) tritones += 1;
    } else {
      run = 0;
      tritones = 0;
    }
    best = Math.max(best, run);
  }
  return best >= MIN_QUARTAL_RUN && best + 1 >= notes.length - 1;
}

/** The top three notes spell a major or minor triad on another root, carrying a tension. */
function isUpperStructure(notes: number[], chord: ChordRef): boolean {
  if (notes.length < 4) return false;
  const top = notes.slice(-3);
  const pcs = new Set(top.map(mod12));
  if (pcs.size !== 3) return false;
  const triadRoot = Array.from(pcs).find((r) =>
    [[4, 7], [3, 7]].some(([third, fifth]) => pcs.has(mod12(r + third)) && pcs.has(mod12(r + fifth))),
  );
  if (triadRoot === undefined || triadRoot === mod12(chord.rootPc)) return false;
  return degreesOf(top, chord).some((d) => d.role === 'tension');
}

/** Undo a drop by raising the bass an octave; a close position means it was dropped. */
function dropForm(notes: number[]): Structure | null {
  if (notes.length !== DROP_SIZE) return null;
  const [bass, a, b, top] = notes;
  const raised = bass + OCTAVE;
  const isClose = (voices: number[]) => voices[voices.length - 1] - voices[0] < OCTAVE;
  if (raised > b && raised < top && isClose([a, b, raised, top])) return 'drop2';
  if (raised > a && raised < b && isClose([a, raised, b, top])) return 'drop3';
  return null;
}
