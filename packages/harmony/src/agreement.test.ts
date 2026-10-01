/**
 * How often the engine's most likely reading is the one a person meant.
 * Two labelled sets: the author's readings in the seed CSV (any authored
 * reading counts, since a shape like F·A·C·E is honestly both Fmaj7 and
 * Dm9/F) and the chord each Woodshed fixture was built as. The prior weight,
 * thin-rootless penalty and temperature in detect.ts were fitted on these;
 * the floors sit just under the fitted values so a regression shows up.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/woodshed.json';
import { detectChord, type Reading } from './detect';
import { mod12, pitchToMidi } from './pitch';
import { familyOf } from './qualities';
import { parseSymbol } from './symbol';

type Labelled = { notes: number[]; isIntended: (r: Reading) => boolean };
type SeedRow = { pitches: string; symbols: string; status: string };
type Fixture = { midi: number[]; intended: { root_pc: number; family: string } };

const SEED_CSV = path.resolve(__dirname, '../../../docs/data/voicings-seed.csv');

const seed: Labelled[] = (
  parse(fs.readFileSync(SEED_CSV, 'utf8'), { columns: true, trim: true }) as SeedRow[]
)
  .filter((row) => row.status === 'ready' && row.symbols)
  .map((row) => {
    const authored = row.symbols.split(';').map((s) => parseSymbol(s.trim()));
    return {
      notes: row.pitches.split(' ').map(pitchToMidi),
      isIntended: (r) =>
        authored.some((a) => mod12(a.rootPc) === r.rootPc && a.quality === r.quality),
    };
  });

const woodshed: Labelled[] = (fixtures as Fixture[]).map((f) => ({
  notes: f.midi,
  isIntended: (r) =>
    r.rootPc === f.intended.root_pc && familyOf(r.quality, r.tensions) === f.intended.family,
}));

function agreement(cases: Labelled[]) {
  let top1 = 0;
  let top3 = 0;
  for (const c of cases) {
    const rank = detectChord(c.notes, Infinity).readings.findIndex(c.isIntended);
    if (rank === 0) top1++;
    if (rank >= 0 && rank < 3) top3++;
  }
  return { top1: top1 / cases.length, top3: top3 / cases.length };
}

describe('agreement with labelled readings', () => {
  it('ranks an authored seed reading first for most voicings', () => {
    expect(seed.length).toBeGreaterThan(70);
    const { top1, top3 } = agreement(seed);
    expect(top1).toBeGreaterThanOrEqual(0.82);
    expect(top3).toBeGreaterThanOrEqual(0.95);
  });

  it('ranks the intended Woodshed chord first for most templates', () => {
    const { top1, top3 } = agreement(woodshed);
    expect(top1).toBeGreaterThanOrEqual(0.72);
    expect(top3).toBeGreaterThanOrEqual(0.98);
  });
});

describe('reading probabilities', () => {
  it('sum to at most 1 and follow the ranking', () => {
    for (const c of [...seed, ...woodshed]) {
      const { readings } = detectChord(c.notes, Infinity);
      const total = readings.reduce((sum, r) => sum + r.probability, 0);
      expect(total).toBeCloseTo(1, 6);
      readings.slice(1).forEach((r, i) => {
        expect(r.probability).toBeLessThanOrEqual(readings[i].probability);
      });
    }
  });

  it('prefer the common name for an ambiguous shape', () => {
    const [g13, dm69] = detectChord([59, 64, 65, 69]).readings; // B·E·F·A
    expect(g13.symbol).toBe('G13/B');
    expect(dm69.symbol).toBe('Dmin6/9/B');
    expect(g13.probability).toBeGreaterThan(0.7);
  });

  it('read three notes as a triad rather than a rootless seventh chord', () => {
    const [top] = detectChord([48, 52, 55]).readings; // C·E·G
    expect(top.symbol).toBe('CMaj');
    expect(top.probability).toBeGreaterThan(0.7);
  });

  it('give rootless minor-major and minor-six-nine voicings a reading', () => {
    expect(detectChord([51, 55, 59, 62]).readings[0].quality).toBe('mMaj7'); // Eb·G·B·D
    const sixNine = detectChord([51, 57, 62, 67]).readings; // Eb·A·D·G
    expect(sixNine.some((r) => r.quality === 'm6' && r.rootPc === 0)).toBe(true);
  });

  it('flag notes that need context to name', () => {
    expect(detectChord([48, 52, 55, 57]).ambiguous).toBe(true); // C6 or Am7/C
    expect(detectChord([53, 57, 60, 64]).ambiguous).toBe(false); // Fmaj7
  });
});
