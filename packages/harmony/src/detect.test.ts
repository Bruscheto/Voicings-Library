import { describe, expect, it } from 'vitest';
import { detectChord, readAs } from './detect';
import { notes } from './testNotes';

const top = (pitches: string) => detectChord(notes(pitches)).readings[0];
const symbols = (pitches: string) => detectChord(notes(pitches)).readings.map((r) => r.symbol);

describe('detectChord', () => {
  it('reads root-position extended chords', () => {
    expect(top('C3 E3 G3 B3 D4')).toMatchObject({
      root: 'C',
      quality: 'Maj7',
      tensions: ['9'],
      rootless: false,
      family: 'maj7',
    });
    expect(top('C3 E3 G3 B3 D4').symbol).toBe('CMaj9');
  });

  it('folds a major triad plus 13 into a sixth chord and flags the Am7 ambiguity', () => {
    const detection = detectChord(notes('C3 E3 G3 A3'));
    expect(detection.readings[0]).toMatchObject({ root: 'C', quality: '6', tensions: [] });
    expect(detection.readings[1].symbol).toBe('Amin7/C');
    expect(detection.ambiguous).toBe(true);
    expect(symbols('C3 E3 G3 A3').filter((s) => s.startsWith('CMaj'))).toEqual(['CMaj6']);
  });

  it('reads a Bill Evans rootless dominant as G13', () => {
    const reading = top('B3 E4 F4 A4');
    expect(reading).toMatchObject({
      root: 'G',
      quality: '7',
      tensions: ['9', '13'],
      rootless: true,
      bass: 'B',
    });
    expect(reading.symbol).toBe('G13/B');
  });

  it('offers the rootless reading of an Em7 shape as Cmaj9', () => {
    const readings = detectChord(notes('E3 G3 B3 D4')).readings;
    expect(readings[0].symbol).toBe('Emin7');
    expect(readings.some((r) => r.root === 'C' && r.quality === 'Maj7' && r.rootless)).toBe(true);
  });

  it('reads the So What chord as Em11 and still offers G6/9', () => {
    const detection = detectChord(notes('E3 A3 D4 G4 B4'));
    expect(detection.readings[0]).toMatchObject({ root: 'E', quality: 'min7', tensions: ['11'] });
    expect(detection.readings[1].symbol).toBe('G6/9/E');
  });

  it('marks altered dominants with the 7alt family', () => {
    expect(top('C3 E3 Bb3 Db4 Ab4')).toMatchObject({
      root: 'C',
      quality: '7',
      tensions: ['b9', 'b13'],
      family: '7alt',
    });
  });

  it('reads a close #5 as augmented', () => {
    expect(top('G3 B3 D#4 F4')).toMatchObject({ root: 'G', quality: 'aug7' });
  });

  it('names #9 and #11 over a dominant instead of b3 and b5', () => {
    expect(top('C3 E3 Bb3 D#4 F#4 A4')).toMatchObject({
      root: 'C',
      quality: '7',
      tensions: ['#9', '#11', '13'],
    });
  });

  it('keeps symmetric diminished chords on the bass', () => {
    const detection = detectChord(notes('B3 D4 F4 Ab4'));
    expect(detection.readings[0].symbol).toBe('Bdim7');
    expect(detection.ambiguous).toBe(true);
  });

  it('reads a tritone as the two dominants it implies', () => {
    expect(symbols('B3 F4').sort()).toEqual(['Db7/B', 'G7/B']);
  });

  it('never reads a triad without its root', () => {
    expect(detectChord(notes('E3 G3')).readings.every((r) => !r.rootless)).toBe(true);
  });

  it('reads suspended and quartal chords', () => {
    expect(top('C3 F3 G3 Bb3 D4')).toMatchObject({
      root: 'C',
      quality: '7sus4',
      tensions: ['9'],
      family: 'sus',
    });
    expect(top('C3 D3 G3').quality).toBe('sus2');
  });

  it('penalises avoid tensions', () => {
    const reading = detectChord(notes('C3 E3 F3 G3 B3')).readings.find(
      (r) => r.root === 'C' && r.quality === 'Maj7',
    );
    const clean = top('C3 E3 G3 B3');
    expect(reading).toBeDefined();
    expect(reading!.score).toBeLessThan(clean.score);
  });

  it('returns nothing for fewer than two pitch classes', () => {
    expect(detectChord(notes('C3 C4'))).toEqual({ readings: [], ambiguous: false });
    expect(detectChord([])).toEqual({ readings: [], ambiguous: false });
  });

  it('respects the limit', () => {
    expect(detectChord(notes('C3 E3 G3 B3 D4'), 2).readings).toHaveLength(2);
  });
});

describe('readAs', () => {
  it('validates an authored reading the ranking would bury', () => {
    const reading = readAs(notes('E3 B3 D4 F#4 A4'), 0, 'Maj7');
    expect(reading).toMatchObject({ root: 'C', tensions: ['9', '#11', '13'], rootless: true });
  });

  it('accepts any rootless seventh chord the author names', () => {
    expect(readAs(notes('F3 A3 B3 E4'), 2, 'm6')).toMatchObject({
      rootless: true,
      tensions: ['9'],
    });
  });

  it('rejects readings the notes cannot support', () => {
    expect(readAs(notes('A2 D3 G3 C4 E4 G4'), 10, '7')).toBeNull();
    expect(readAs(notes('C3 Eb3 G3'), 0, 'Maj')).toBeNull();
    expect(readAs(notes('E3 G3'), 0, 'Maj')).toBeNull();
    expect(readAs([], 0, 'Maj')).toBeNull();
  });
});
