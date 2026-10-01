import { describe, expect, it } from 'vitest';
import { fromShape, placeShape, toShape, transpose } from './shape';
import { notes } from './testNotes';

describe('shapes', () => {
  it('keys a voicing by its intervals so transpositions collide', () => {
    const a = toShape(notes('B3 E4 F4 A4'));
    const b = toShape(notes('E3 A3 Bb3 D4'));
    expect(a).toEqual({ intervals: [0, 5, 6, 10], bassMidi: 59, shapeKey: '0-5-6-10' });
    expect(b.shapeKey).toBe(a.shapeKey);
    expect(() => toShape([])).toThrow();
  });

  it('rebuilds and transposes', () => {
    expect(fromShape([0, 5, 6, 10], 59)).toEqual(notes('B3 E4 F4 A4'));
    expect(transpose([60, 64], -12)).toEqual([48, 52]);
  });

  it('places a shape on every fitting bass of a pitch class', () => {
    expect(placeShape([0, 5, 6, 10], 11, { low: 48, high: 84 })).toEqual([
      [59, 64, 65, 69],
      [71, 76, 77, 81],
    ]);
    expect(placeShape([0, 30], 0, { low: 60, high: 72 })).toEqual([]);
  });
});
