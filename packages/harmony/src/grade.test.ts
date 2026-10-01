import { describe, expect, it } from 'vitest';
import { gradeAttempt, gradeExact } from './grade';
import { notes } from './testNotes';

const G7 = { rootPc: 7, quality: '7' } as const;

describe('gradeAttempt', () => {
  it('accepts any voicing with the guide tones', () => {
    expect(gradeAttempt(notes('B3 E4 F4 A4'), G7).outcome).toBe('correct');
    expect(gradeAttempt(notes('F3 A3 B3 E4'), G7).outcome).toBe('correct');
    expect(gradeAttempt(notes('G2 B2 F3'), G7).outcome).toBe('correct');
  });

  it('reports missing guide tones', () => {
    expect(gradeAttempt(notes('G3 B3 D4'), G7)).toMatchObject({
      outcome: 'incorrect',
      missingGuideTones: [5],
    });
  });

  it('flags clashing and avoid notes as close', () => {
    expect(gradeAttempt(notes('B3 C4 F4'), G7)).toMatchObject({ outcome: 'close', clashes: [60] });
    expect(gradeAttempt(notes('C4 E4 B4 F#5'), { rootPc: 0, quality: 'Maj7' }).outcome).toBe(
      'correct',
    );
    expect(gradeAttempt(notes('C4 E4 F4 B4'), { rootPc: 0, quality: 'Maj7' })).toMatchObject({
      outcome: 'close',
      clashes: [65],
    });
  });

  it('needs two pitch classes', () => {
    expect(gradeAttempt(notes('B3 B4'), G7).outcome).toBe('insufficient');
  });
});

describe('gradeExact', () => {
  it('compares pitch classes exactly', () => {
    const target = notes('B3 E4 F4 A4');
    expect(gradeExact(notes('B2 E3 F3 A3'), target).outcome).toBe('correct');
    expect(gradeExact(notes('F3 A3 B3 E4'), target).outcome).toBe('correct');
    expect(gradeExact(notes('B3 E4 F4 G4'), target)).toMatchObject({
      outcome: 'incorrect',
      missingGuideTones: [9],
      clashes: [67],
    });
    expect(gradeExact(notes('B3'), target).outcome).toBe('insufficient');
  });
});
