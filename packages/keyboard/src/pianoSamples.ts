/**
 * Which Splendid Grand Piano samples to load: one velocity layer, and about
 * one sample per minor third across the 88 keys. smplr plays every other key
 * from the nearest loaded sample, pitch-shifted (at most two semitones).
 */

import { LAYERS } from 'smplr';

const LOWEST_KEY = 21; // A0
const HIGHEST_KEY = 108; // C8
const SAMPLE_SPACING = 3;
const LAYER_NAME = 'MF';

type Layer = { name: string; vel_range: number[]; samples: (string | number)[][] };

const layer = (LAYERS as Layer[]).find((l) => l.name === LAYER_NAME);
if (!layer) throw new Error(`smplr has no ${LAYER_NAME} piano layer`);

const samples = layer.samples.map(([midi, name]) => ({ midi: Number(midi), name: String(name) }));

/** For every target key in range, the nearest available sample root, deduplicated. */
export function pickSampleNotes(
  roots: readonly number[],
  lowest = LOWEST_KEY,
  highest = HIGHEST_KEY,
  spacing = SAMPLE_SPACING,
): number[] {
  const picked = new Set<number>();
  for (let target = lowest; target <= highest; target += spacing) {
    const nearest = roots.reduce((best, root) =>
      Math.abs(root - target) < Math.abs(best - target) ? root : best,
    );
    picked.add(nearest);
  }
  return [...picked].sort((a, b) => a - b);
}

export const PIANO_SAMPLE_NOTES = pickSampleNotes(samples.map((s) => s.midi));

/** Sample file names (without extension) for the picked notes, for self-hosting. */
export const PIANO_SAMPLE_FILES = samples
  .filter((s) => PIANO_SAMPLE_NOTES.includes(s.midi))
  .map((s) => s.name);

export const PIANO_VELOCITY_RANGE: [number, number] = [layer.vel_range[0], layer.vel_range[1]];
export const PIANO_VELOCITY = Math.round((layer.vel_range[0] + layer.vel_range[1]) / 2);
