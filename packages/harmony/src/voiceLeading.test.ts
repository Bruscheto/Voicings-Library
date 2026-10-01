import { describe, expect, it } from 'vitest';
import { solvePath, voiceLeadingCost } from './voiceLeading';
import { notes } from './testNotes';

describe('voiceLeadingCost', () => {
  it('sums movement between equal-size voicings', () => {
    // Dm9 → G13 rootless A forms: F→F, A→A, C→B, E→E
    expect(voiceLeadingCost(notes('F3 A3 C4 E4'), notes('F3 A3 B3 E4'))).toBe(1);
  });

  it('charges added or dropped voices', () => {
    expect(voiceLeadingCost(notes('C4 E4 G4'), notes('C4 E4 G4 B4'))).toBe(3);
    expect(voiceLeadingCost(notes('C4 E4 G4 B4'), notes('C4 E4 G4'))).toBe(3);
  });
});

describe('solvePath', () => {
  const dm = [notes('F3 A3 C4 E4'), notes('C4 E4 F4 A4')];
  const g = [notes('B2 E3 F3 A3'), notes('F3 A3 B3 E4')];
  const c = [notes('E3 G3 B3 D4'), notes('B3 D4 E4 G4')];

  it('chooses the smoothest ii–V–I', () => {
    const path = solvePath([dm, g, c], (v) => v);
    expect(path?.steps).toEqual([dm[0], g[1], c[0]]);
    expect(path?.cost).toBe(1 + 5);
  });

  it('honours a pinned step', () => {
    const path = solvePath([dm, [g[0]], c], (v) => v);
    expect(path?.steps[1]).toEqual(g[0]);
  });

  it('returns null when a step has no options', () => {
    expect(solvePath([dm, []], (v) => v)).toBeNull();
    expect(solvePath([], (v: number[]) => v)).toBeNull();
  });
});

describe('solvePath option cost', () => {
  it('trades movement against a per-option cost', () => {
    const low = [notes('C3 E3 G3')];
    const options = [low, [notes('C3 E3 G3'), notes('C4 E4 G4')]];
    expect(solvePath(options, (v) => v)?.steps[1]).toEqual(notes('C3 E3 G3'));
    const preferHigh = (v: number[]) => (v[0] < 60 ? 100 : 0);
    expect(solvePath([[notes('C4 E4 G4')], options[1]], (v) => v, preferHigh)?.steps[1]).toEqual(
      notes('C4 E4 G4'),
    );
  });
});
