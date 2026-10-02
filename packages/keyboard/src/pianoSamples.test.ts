import { describe, expect, it } from 'vitest';
import {
  PIANO_SAMPLE_FILES,
  PIANO_SAMPLE_NOTES,
  PIANO_VELOCITY,
  PIANO_VELOCITY_RANGE,
  pickSampleNotes,
} from './pianoSamples';

const A0 = 21;
const C8 = 108;
const MAX_SHIFT = 2;

describe('piano sample selection', () => {
  it('reaches every key of the piano within two semitones', () => {
    for (let key = A0; key <= C8; key++) {
      const shift = Math.min(...PIANO_SAMPLE_NOTES.map((note) => Math.abs(note - key)));
      expect(shift).toBeLessThanOrEqual(MAX_SHIFT);
    }
  });

  it('loads one file per picked note', () => {
    expect(PIANO_SAMPLE_NOTES).toHaveLength(29);
    expect(PIANO_SAMPLE_FILES).toHaveLength(PIANO_SAMPLE_NOTES.length);
    expect(PIANO_SAMPLE_FILES).toContain('MF C3');
  });

  it('plays inside the loaded velocity layer', () => {
    expect(PIANO_VELOCITY).toBeGreaterThanOrEqual(PIANO_VELOCITY_RANGE[0]);
    expect(PIANO_VELOCITY).toBeLessThanOrEqual(PIANO_VELOCITY_RANGE[1]);
  });

  it('picks the nearest root for each target and drops duplicates', () => {
    expect(pickSampleNotes([10, 20, 30], 9, 31, 3)).toEqual([10, 20, 30]);
    expect(pickSampleNotes([60], 50, 70, 5)).toEqual([60]);
  });
});
