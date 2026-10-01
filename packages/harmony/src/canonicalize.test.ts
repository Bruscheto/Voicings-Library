import { describe, expect, it } from 'vitest';
import { buildSymbol, canonicalizeChord, chordSegments, toBase } from './canonicalize';

describe('toBase', () => {
  it.each([
    ['min11', [], 'min7', ['9', '11']],
    ['min11', ['b13'], 'min7', ['9', '11', 'b13']],
    ['min13', [], 'min7', ['9', '11', '13']],
    ['13', ['#11'], '7', ['9', '#11', '13']],
    ['Maj', ['13'], '6', []],
    ['min', ['13'], 'm6', []],
    ['dim7', ['13', '9'], 'dim7', ['9']],
    ['9sus4', [], '7sus4', ['9']],
    ['6/9', [], '6', ['9']],
    ['add9', [], 'Maj', ['9']],
    ['7#5', ['b9'], 'aug7', ['b9']],
    ['Maj6', [], '6', []],
  ])('%s + %j → %s + %j', (quality, tensions, base, all) => {
    expect(toBase(quality, tensions)).toEqual({ quality: base, tensions: all });
  });
});

describe('canonicalizeChord', () => {
  it.each([
    ['min7', ['9'], 'min9', []],
    ['min7', ['9', '11'], 'min11', []],
    ['min7', ['13'], 'min7', ['13']],
    ['min7', ['9', '#11'], 'min9', ['#11']],
    ['7', ['9', '13'], '13', []],
    ['Maj7', ['9', '11', '13'], 'Maj13', ['11']],
    ['7sus4', ['9', '13'], '13sus4', []],
    ['6', ['9'], '6/9', []],
    ['6', [], 'Maj6', []],
    ['m6', ['9'], 'min6/9', []],
    ['m7b5', ['9'], 'm9b5', []],
    ['dim7', ['9', '11'], 'dim11', []],
    ['aug7', ['9'], 'aug9', []],
  ])('%s + %j displays as %s + %j', (quality, tensions, display, rest) => {
    expect(canonicalizeChord(quality, tensions)).toEqual({ quality: display, tensions: rest });
  });

  it('keeps unknown tensions after known ones', () => {
    expect(canonicalizeChord('7', ['x', 'b9', 'y'])).toEqual({
      quality: '7',
      tensions: ['b9', 'x', 'y'],
    });
  });
});

describe('symbols', () => {
  it('splits alterations and added naturals', () => {
    expect(chordSegments('C', 'Maj7', ['9', '#11', '13'], null)).toEqual(['C', 'Maj13', '(#11)']);
    expect(chordSegments('C', 'Maj7', ['b9', '#11', '13'], 'E')).toEqual([
      'C',
      'Maj7',
      '(b9,#11)',
      'add13',
      '/',
      'E',
    ]);
    expect(chordSegments('C', 'Maj7', ['9', '11', '13'], null)).toEqual(['C', 'Maj13', '(11)']);
  });

  it('joins segments', () => {
    expect(buildSymbol('Bb', '7', ['9', '13'], null)).toBe('Bb13');
    expect(buildSymbol('D', 'min7', ['9'], 'F')).toBe('Dmin9/F');
  });
});
