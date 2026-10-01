import { describe, expect, it } from 'vitest';
import { rootName, spellMidi, spellPc, spellVoicing } from './spelling';
import { notes } from './testNotes';
import type { BaseQuality } from './qualities';

const chord = (rootPc: number, quality: BaseQuality, tensions: string[] = []) => ({
  rootPc,
  quality,
  tensions,
});
const spell = (pitches: string, rootPc: number, quality: BaseQuality, tensions: string[] = []) =>
  spellVoicing(notes(pitches), chord(rootPc, quality, tensions)).join(' ');

describe('rootName', () => {
  it.each([
    [1, 'min7', 'C#'],
    [1, 'Maj7', 'Db'],
    [6, 'min7', 'F#'],
    [6, '7', 'F#'],
    [6, 'Maj7', 'Gb'],
    [8, 'min7', 'G#'],
    [8, 'Maj7', 'Ab'],
    [3, 'min7', 'Eb'],
    [10, 'min7', 'Bb'],
    [11, '7', 'B'],
    [0, 'Maj7', 'C'],
  ] as const)('pc %i %s → %s', (pc, quality, name) => {
    expect(rootName(chord(pc, quality))).toBe(name);
  });
});

describe('spellVoicing', () => {
  it('spells F#m9 with sharps by degree', () => {
    expect(spell('F#3 A3 Db4 E4 Ab4', 6, 'min7', ['9'])).toBe('F#3 A3 C#4 E4 G#4');
  });

  it('spells flat keys with flats', () => {
    expect(spell('Db3 F3 Ab3 C4', 1, 'Maj7')).toBe('Db3 F3 Ab3 C4');
    expect(spell('Bb3 D4 F4 A4', 7, 'min7', ['9'])).toBe('Bb3 D4 F4 A4');
  });

  it('names tensions by their degree letter', () => {
    expect(spell('G3 B3 F4 Bb4', 7, '7', ['#9'])).toBe('G3 B3 F4 A#4');
    expect(spell('C4 E4 Bb4 Db5', 0, '7', ['b9'])).toBe('C4 E4 Bb4 Db5');
    expect(spell('C4 E4 Bb4 F#5', 0, '7', ['#11'])).toBe('C4 E4 Bb4 F#5');
    expect(spell('B3 Eb4 Gb4 A4', 11, '7')).toBe('B3 D#4 F#4 A4');
  });

  it('falls back to plain names instead of exotic spellings', () => {
    expect(spell('C4 Eb4 Gb4 A4', 0, 'dim7')).toBe('C4 Eb4 Gb4 A4');
    expect(spellPc(11, chord(1, '7'))).toBe('B');
    expect(spell('E3 Ab3 D4 G4', 4, '7', ['#9'])).toBe('E3 G#3 D4 G4');
  });

  it('keeps octaves attached to the written letter', () => {
    expect(spellMidi(61, chord(9, 'Maj'))).toBe('C#4');
    expect(spellMidi(61, chord(1, 'Maj7'))).toBe('Db4');
  });

  it('falls back for notes the chord cannot name', () => {
    expect(spellMidi(61, chord(0, 'Maj7'))).toBe('Db4');
    expect(spellMidi(61, chord(2, 'Maj7'))).toBe('C#4');
  });
});
