/**
 * Transposition-invariant voicing shapes: intervals above the bass. One
 * captured shape stands for the same voicing in all twelve keys.
 */

import { mod12, normalizeNotes, type PitchClass } from './pitch';

export type Shape = {
  /** Semitones above the lowest note; always starts with 0. */
  intervals: number[];
  bassMidi: number;
  /** Stable identity for duplicate detection across keys. */
  shapeKey: string;
};

export type Range = { low: number; high: number };

export function toShape(midi: readonly number[]): Shape {
  const notes = normalizeNotes(midi);
  if (notes.length === 0) throw new Error('a shape needs at least one note');
  const intervals = notes.map((n) => n - notes[0]);
  return { intervals, bassMidi: notes[0], shapeKey: intervals.join('-') };
}

export function transpose(midi: readonly number[], semitones: number): number[] {
  return midi.map((n) => n + semitones);
}

/** The shape built on a given bass note. */
export function fromShape(intervals: readonly number[], bassMidi: number): number[] {
  return intervals.map((i) => bassMidi + i);
}

/**
 * Every placement of a shape whose bass has the given pitch class and whose
 * notes all fit inside the range, lowest first.
 */
export function placeShape(intervals: readonly number[], bassPc: PitchClass, range: Range): number[][] {
  const span = intervals[intervals.length - 1] ?? 0;
  const placements: number[][] = [];
  const first = range.low + mod12(bassPc - range.low);
  for (let bass = first; bass + span <= range.high; bass += 12) {
    placements.push(fromShape(intervals, bass));
  }
  return placements;
}
