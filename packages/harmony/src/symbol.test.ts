import { describe, expect, it } from 'vitest';
import { isSymbol, parseSymbol } from './symbol';

describe('parseSymbol', () => {
  it.each([
    ['Dm9', 'D', 'min7', ['9'], null],
    ['Dm7', 'D', 'min7', [], null],
    ['D-7', 'D', 'min7', [], null],
    ['CΔ7', 'C', 'Maj7', [], null],
    ['Cmaj7#11', 'C', 'Maj7', ['#11'], null],
    ['Bb13(#11)', 'Bb', '7', ['9', '#11', '13'], null],
    ['G7(b9,#11)', 'G', '7', ['b9', '#11'], null],
    ['G7b9b13', 'G', '7', ['b9', 'b13'], null],
    ['F#m7b5', 'F#', 'm7b5', [], null],
    ['Bø', 'B', 'm7b5', [], null],
    ['C6/9', 'C', '6', ['9'], null],
    ['C6/9/E', 'C', '6', ['9'], 4],
    ['Ebmaj7/G', 'Eb', 'Maj7', [], 7],
    ['Cadd9', 'C', 'Maj', ['9'], null],
    ['C9sus4', 'C', '7sus4', ['9'], null],
    ['C11', 'C', '7sus4', ['9'], null],
    ['Co7', 'C', 'dim7', [], null],
    ['C+7', 'C', 'aug7', [], null],
    ['C7#5', 'C', 'aug7', [], null],
    ['C7b5', 'C', '7', ['#11'], null],
    ['C', 'C', 'Maj', [], null],
    ['Cm', 'C', 'min', [], null],
    ['Cmin13', 'C', 'min7', ['9', '11', '13'], null],
    ['Db7/Db', 'Db', '7', [], null],
    ['C#m7', 'Db', 'min7', [], null],
  ])('%s', (symbol, root, quality, tensions, bassPc) => {
    expect(parseSymbol(symbol)).toMatchObject({ root, quality, tensions, bassPc });
  });

  it('flags 7alt', () => {
    expect(parseSymbol('G7alt')).toMatchObject({ quality: '7', tensions: [], altered: true });
  });

  it.each(['', 'H7', 'Cxyz', 'Cmaj7b9', 'Cm7#9', 'C5'])('rejects %j', (symbol) => {
    expect(() => parseSymbol(symbol)).toThrow();
    expect(isSymbol(symbol)).toBe(false);
  });

  it('accepts real symbols', () => {
    expect(isSymbol('Am7')).toBe(true);
  });
});
