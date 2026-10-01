import { describe, expect, it } from 'vitest';
import { degreesOf, guideTones } from './degrees';
import { notes } from './testNotes';

describe('degreesOf', () => {
  it('labels a rootless G13 and marks its guide tones', () => {
    const degrees = degreesOf(notes('B3 E4 F4 A4'), { rootPc: 7, quality: '7' });
    expect(degrees.map((d) => d.label)).toEqual(['3', '13', 'b7', '9']);
    expect(degrees.filter((d) => d.isGuideTone).map((d) => d.label)).toEqual(['3', 'b7']);
  });

  it('names chord tones by quality (b5 on m7b5, bb7 on dim7, 4 on sus)', () => {
    expect(
      degreesOf(notes('B3 D4 F4 A4'), { rootPc: 11, quality: 'm7b5' }).map((d) => d.label),
    ).toEqual(['R', 'b3', 'b5', 'b7']);
    expect(
      degreesOf(notes('C4 Eb4 Gb4 A4'), { rootPc: 0, quality: 'dim7' }).map((d) => d.label),
    ).toEqual(['R', 'b3', 'b5', 'bb7']);
    expect(degreesOf(notes('C4 F4 G4 Bb4'), { rootPc: 0, quality: '7sus4' })[1]).toMatchObject({
      label: '4',
      isGuideTone: true,
    });
  });

  it('marks notes the chord cannot name', () => {
    expect(degreesOf(notes('C4 E4 Bb4'), { rootPc: 0, quality: 'Maj7' })[2]).toMatchObject({
      label: '?',
      role: 'tension',
    });
  });
});

describe('guideTones', () => {
  it('returns the 3rd and 7th (or 6th)', () => {
    expect(guideTones({ rootPc: 2, quality: 'min7' })).toEqual([5, 0]);
    expect(guideTones({ rootPc: 0, quality: '6' })).toEqual([4, 9]);
    expect(guideTones({ rootPc: 0, quality: 'Maj' })).toEqual([4]);
  });
});
