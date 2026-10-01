import { describe, expect, it } from 'vitest';
import { fixtureLibrary } from './libraryFixture';
import { buildPath, registerCost, stepOptions, twoFiveOne, DEFAULT_RANGE } from './progression';
import { voiceLeadingCost } from './voiceLeading';

const library = fixtureLibrary();

describe('twoFiveOne', () => {
  it('spells major and minor ii–V–I', () => {
    expect(twoFiveOne(0, 'major').map((s) => [s.label, s.rootPc, s.qualities[0]])).toEqual([
      ['ii', 2, 'min7'],
      ['V7', 7, '7'],
      ['Imaj7', 0, 'Maj7'],
    ]);
    expect(twoFiveOne(9, 'minor').map((s) => s.rootPc)).toEqual([11, 4, 9]);
    expect(twoFiveOne(0, 'minor')[1].altered).toBe(true);
  });
});

describe('buildPath', () => {
  it('alternates rootless A and B forms for the smoothest ii–V–I in C', () => {
    const path = buildPath(library, twoFiveOne(0, 'major'));
    if (!path.ok) throw new Error('expected a path');
    const forms = path.steps.map((s) => s.chosen.voicing.id.slice(-1));
    expect(['aba', 'bab']).toContain(forms.join(''));
    expect(path.movement).toBe(path.steps.reduce((sum, s) => sum + s.movement, 0));
    expect(path.steps[0].movement).toBe(0);
  });

  it('works in every key and register', () => {
    for (let key = 0; key < 12; key++) {
      const path = buildPath(library, twoFiveOne(key, 'major'));
      expect(path.ok).toBe(true);
      if (!path.ok) continue;
      for (const step of path.steps) {
        expect(Math.min(...step.chosen.midi)).toBeGreaterThanOrEqual(DEFAULT_RANGE.low);
        expect(Math.max(...step.chosen.midi)).toBeLessThanOrEqual(DEFAULT_RANGE.high);
      }
    }
  });

  it('re-solves around a pinned step', () => {
    const free = buildPath(library, twoFiveOne(0, 'major'));
    if (!free.ok) throw new Error('expected a path');
    const pin = free.steps[1].alternatives[0].key;
    const pinned = buildPath(library, twoFiveOne(0, 'major'), [null, pin, null]);
    if (!pinned.ok) throw new Error('expected a path');
    expect(pinned.steps[1].chosen.key).toBe(pin);
    expect(pinned.movement).toBeGreaterThanOrEqual(free.movement);
  });

  it('ignores a pin that no longer exists', () => {
    const path = buildPath(library, twoFiveOne(0, 'major'), ['gone', null, null]);
    expect(path.ok).toBe(true);
  });

  it('orders alternatives by movement around the chosen neighbours and register', () => {
    const path = buildPath(library, twoFiveOne(0, 'major'));
    if (!path.ok) throw new Error('expected a path');
    const [ii, v, i] = path.steps;
    const around = (midi: number[]) =>
      voiceLeadingCost(ii.chosen.midi, midi) +
      voiceLeadingCost(midi, i.chosen.midi) +
      registerCost(midi);
    const costs = v.alternatives.map((o) => around(o.midi));
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
  });

  it('builds a minor ii–V–i from altered dominants', () => {
    const path = buildPath(library, twoFiveOne(0, 'minor'));
    if (!path.ok) throw new Error('expected a path');
    expect(path.steps.map((s) => s.chosen.voicing.id)).toEqual(['dm7b5', 'g7alt', 'cm6']);
  });

  it('reports the steps the library cannot play', () => {
    const noDominants = library.filter((v) => !['g13-a', 'g13-b', 'g7alt'].includes(v.id));
    const path = buildPath(noDominants, twoFiveOne(0, 'major'));
    expect(path).toEqual({ ok: false, missing: [twoFiveOne(0, 'major')[1]] });
  });

  it('lists every placement in range', () => {
    expect(
      stepOptions(library, twoFiveOne(0, 'major')[0], { low: 0, high: 127 }).length,
    ).toBeGreaterThan(10);
  });
});

describe('registerCost', () => {
  it('is free near middle C and grows with drift', () => {
    expect(registerCost([57, 60, 64, 67])).toBe(0);
    expect(registerCost([46, 50, 53, 57])).toBeGreaterThan(0);
    expect(registerCost([34, 38, 41, 45])).toBeGreaterThan(registerCost([46, 50, 53, 57]));
  });

  it('keeps the F major ii–V–I out of the mud', () => {
    const path = buildPath(library, twoFiveOne(5, 'major'));
    if (!path.ok) throw new Error('expected a path');
    for (const step of path.steps) expect(Math.min(...step.chosen.midi)).toBeGreaterThanOrEqual(48);
  });
});
