import { describe, expect, it } from 'vitest';
import { classifyStructure } from './structure';
import { notes } from './testNotes';

const G7 = { rootPc: 7, quality: '7' } as const;
const C = (quality: 'Maj7' | '7' | 'min7' | '6') => ({ rootPc: 0, quality });

describe('classifyStructure', () => {
  it('tags a root-3-7 shell', () => {
    expect(classifyStructure(notes('G2 B2 F3'), G7)).toEqual(['shell', 'close']);
    expect(classifyStructure(notes('G2 F3 B3'), G7)).toEqual(['shell', 'open']);
    expect(classifyStructure(notes('G2 D3 F3'), G7)).not.toContain('shell');
  });

  it('tags rootless A and B forms', () => {
    expect(classifyStructure(notes('B3 E4 F4 A4'), G7)).toContain('rootless-a');
    expect(classifyStructure(notes('F3 A3 B3 E4'), G7)).toContain('rootless-b');
    expect(classifyStructure(notes('A3 B3 E4 F4'), G7)).not.toContain('rootless-a');
    expect(classifyStructure(notes('G3 B3 E4 F4'), G7)).not.toContain('rootless-a');
    expect(classifyStructure(notes('E4 A4 B4 D5'), { rootPc: 7, quality: '7' })).not.toContain(
      'rootless-a',
    );
  });

  it('tags a quartal stack', () => {
    expect(classifyStructure(notes('E3 A3 D4 G4 B4'), { rootPc: 4, quality: 'min7' })).toEqual([
      'quartal',
      'open',
    ]);
    expect(classifyStructure(notes('C3 F3 B3 E4'), C('Maj7'))).toContain('quartal');
    expect(classifyStructure(notes('C3 E3 G3 B3'), C('Maj7'))).not.toContain('quartal');
  });

  it('tags an upper-structure triad carrying a tension', () => {
    expect(classifyStructure(notes('E3 Bb3 D4 F#4 A4'), C('7'))).toContain('ust');
    expect(classifyStructure(notes('C3 E3 G3 C4 E4 G4'), C('Maj7'))).not.toContain('ust');
    expect(classifyStructure(notes('C3 E3 G3 B3'), C('Maj7'))).not.toContain('ust');
    expect(classifyStructure(notes('C3 E3 B3 D4 F#4 A#4'), C('Maj7'))).not.toContain('ust');
  });

  it('tags drop 2 and drop 3', () => {
    expect(classifyStructure(notes('G3 C4 E4 B4'), C('Maj7'))).toContain('drop2');
    expect(classifyStructure(notes('C3 G3 B3 E4'), C('Maj7'))).toContain('drop2');
    expect(classifyStructure(notes('E3 C4 G4 B4'), C('Maj7'))).toContain('drop3');
    expect(classifyStructure(notes('C3 E3 G3 B3'), C('Maj7'))).not.toContain('drop2');
  });

  it('returns nothing for a single note', () => {
    expect(classifyStructure(notes('C3'), C('Maj7'))).toEqual([]);
  });
});
