import { describe, expect, it } from 'vitest';
import { midiToPitch, mod12, normalizeNotes, noteToPc, pcName, pitchToMidi } from './pitch';

describe('pitch', () => {
  it('wraps pitch classes', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(25)).toBe(1);
  });

  it('spells with jazz flats and F#', () => {
    expect([1, 3, 6, 8, 10].map(pcName)).toEqual(['Db', 'Eb', 'F#', 'Ab', 'Bb']);
  });

  it('reads note names with any accidental', () => {
    expect(noteToPc('C#')).toBe(1);
    expect(noteToPc('Cb')).toBe(11);
    expect(noteToPc('Ebb')).toBe(2);
    expect(noteToPc('F##')).toBe(7);
    expect(() => noteToPc('H')).toThrow(/not a note name/);
  });

  it('converts pitches and MIDI both ways', () => {
    expect(pitchToMidi('C4')).toBe(60);
    expect(pitchToMidi('Bb3')).toBe(58);
    expect(pitchToMidi('B#3')).toBe(60);
    expect(pitchToMidi('A0')).toBe(21);
    expect(midiToPitch(61)).toBe('Db4');
    expect(() => pitchToMidi('C')).toThrow(/not a pitch/);
  });

  it('sorts and de-duplicates notes', () => {
    expect(normalizeNotes([64, 60, 64, 67])).toEqual([60, 64, 67]);
  });
});
