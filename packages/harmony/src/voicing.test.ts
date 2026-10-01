import { describe, expect, it } from 'vitest';
import { pitchToMidi } from './pitch';
import { VoicingAnalysisError, analyzeVoicing, realizeVoicing } from './voicing';

const notes = (pitches: string) => pitches.split(' ').map(pitchToMidi);

describe('analyzeVoicing', () => {
  it('stores the engine reading relative to the bass when no symbol is given', () => {
    const analysis = analyzeVoicing(notes('B3 E4 F4 A4'));
    expect(analysis.shape).toEqual({
      intervals: [0, 5, 6, 10],
      bassMidi: 59,
      shapeKey: '0-5-6-10',
    });
    expect(analysis.readings).toEqual([
      { rootOffset: 8, quality: '7', tensions: ['9', '13'], rootless: true, isPrimary: true },
    ]);
    expect(analysis.structure).toContain('rootless-a');
  });

  it('keeps authored symbols in order, first one primary, duplicates dropped', () => {
    const analysis = analyzeVoicing(notes('E3 G3 B3 D4'), ['Em7', 'Cmaj9/E', 'E-7']);
    expect(analysis.readings).toEqual([
      { rootOffset: 0, quality: 'min7', tensions: [], rootless: false, isPrimary: true },
      { rootOffset: 8, quality: 'Maj7', tensions: ['9'], rootless: true, isPrimary: false },
    ]);
  });

  it('accepts an altered dominant written as 7alt', () => {
    expect(analyzeVoicing(notes('E3 Bb3 Db4 Ab4'), ['C7alt']).readings[0]).toMatchObject({
      quality: '7',
      tensions: ['b9', 'b13'],
    });
  });

  it.each([
    ['A2 D3 G3 C4 E4 G4', 'Bb13(#11)/A', /do not spell this chord; they read as/],
    ['E3 B3 D4 F#4 A4', 'Cmaj9(#11)/E', /spell CMaj13\(#11\)/],
    ['F3 C4 G4 D5 A5', 'Dm11/G', /slash bass is G but the lowest note is F/],
    ['B3 E4 F4 A4', 'G7alt', /only altered tensions/],
    ['C4 E4 G4', 'Cxyz', /cannot read/],
  ])('rejects %s as %s', (pitches, symbol, message) => {
    expect(() => analyzeVoicing(notes(pitches), [symbol])).toThrow(message);
  });

  it('rejects notes that are not a voicing', () => {
    expect(() => analyzeVoicing(notes('C4 C5'))).toThrow(VoicingAnalysisError);
    expect(() => analyzeVoicing([12, 60])).toThrow(/outside the piano/);
    expect(() => analyzeVoicing([60.5, 64])).toThrow(/outside the piano/);
  });
});

describe('realizeVoicing', () => {
  const stored = {
    intervals: [0, 5, 6, 10],
    bassMidi: 59,
    readings: [
      { rootOffset: 6, quality: '7', tensions: ['9', '13'], rootless: true, isPrimary: false },
      { rootOffset: 8, quality: '7', tensions: ['9', '13'], rootless: true, isPrimary: true },
    ],
  };

  it('rebuilds notes and spells readings, primary first', () => {
    const view = realizeVoicing(stored);
    expect(view.pitches).toEqual(['B3', 'E4', 'F4', 'A4']);
    expect(view.primary).toMatchObject({ root: 'G', slashBass: 'B', symbol: 'G13/B' });
    expect(view.readings[1].symbol).toBe('F13/B');
  });

  it('transposes to another bass', () => {
    const view = realizeVoicing(stored, 53);
    expect(view.pitches).toEqual(['F3', 'Bb3', 'B3', 'Eb4']);
    expect(view.primary?.symbol).toBe('Db13/F');
  });

  it('handles a voicing without readings', () => {
    expect(realizeVoicing({ ...stored, readings: [] }).primary).toBeNull();
  });
});
