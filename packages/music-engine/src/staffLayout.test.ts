import { describe, expect, it } from 'vitest';
import { parseKey, planGrandStaff } from './staffLayout';

const keysOf = (voices: { key: string }[][]) =>
  voices.map((voice) => voice.map((note) => note.key));

describe('parseKey', () => {
  it('reads every spelling the speller can produce', () => {
    expect(parseKey('f##/5')).toMatchObject({ step: 38, alter: 2, accidental: '##' });
    expect(parseKey('Cb/4')).toMatchObject({ key: 'cb/4', step: 28, alter: -1, accidental: 'b' });
    expect(parseKey('e#/3')).toMatchObject({ step: 23, alter: 1 });
    expect(parseKey('a/0')).toMatchObject({ step: 5, accidental: null });
    expect(parseKey('h/4')).toBeNull();
  });
});

describe('planGrandStaff', () => {
  it('splits at middle C by written position', () => {
    const plan = planGrandStaff(['b#/3', 'cb/4', 'e/4']);
    expect(keysOf(plan.bass.voices)).toEqual([['b#/3']]);
    expect(keysOf(plan.treble.voices)).toEqual([['cb/4', 'e/4']]);
  });

  it('moves a second spelling on the same line into its own voice', () => {
    const plan = planGrandStaff(['c/3', 'e/3', 'bb/3', 'db/4', 'd#/4', 'g/4']);
    expect(keysOf(plan.treble.voices)).toEqual([['d#/4', 'g/4'], ['db/4']]);
  });

  it('marks a natural that shares its line with an altered note', () => {
    const plan = planGrandStaff(['a/4', 'ab/4', 'c/5']);
    const accidentals = plan.treble.voices.flat().map((note) => [note.key, note.accidental]);
    expect(accidentals).toEqual(
      expect.arrayContaining([
        ['a/4', 'n'],
        ['ab/4', 'b'],
        ['c/5', null],
      ]),
    );
  });

  it('drops duplicate keys', () => {
    expect(keysOf(planGrandStaff(['c/4', 'c/4', 'e/4']).treble.voices)).toEqual([['c/4', 'e/4']]);
  });

  it('keeps the conventional gap when nothing sits between the staves', () => {
    expect(planGrandStaff(['g/2', 'f/5']).gap).toBe(50);
    expect(planGrandStaff([]).gap).toBe(50);
  });

  it('widens the gap for ledger notes near middle C on both staves', () => {
    const plain = planGrandStaff(['e/4']).gap;
    const crowded = planGrandStaff(['a/3', 'b/3', 'c/4', 'd/4']).gap;
    // C4 reaches 15px below the treble staff, B3 20px above the bass staff.
    expect(crowded).toBe(Math.max(plain, 15 + 20 + 6));
    expect(planGrandStaff(['c#/4', 'bb/3']).gap).toBeGreaterThan(
      planGrandStaff(['c/4', 'b/3']).gap,
    );
  });

  it('reserves room for notes far above and below the staves', () => {
    const plan = planGrandStaff(['a/0', 'c/8']);
    expect(plan.top).toBe((56 - 38) * 5 + 5 + 6);
    expect(plan.bottom).toBe((18 - 5) * 5 + 5 + 6);
  });
});
