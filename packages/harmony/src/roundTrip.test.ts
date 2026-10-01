/**
 * Every symbol the engine displays must parse back to the same reading: the
 * capture app sends readings to the server as symbols.
 */

import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/woodshed.json';
import { detectChord } from './detect';
import { parseSymbol } from './symbol';

// Deterministic pseudo-random note sets across the keyboard (LCG).
function* randomVoicings(count: number): Generator<number[]> {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let i = 0; i < count; i++) {
    const size = 3 + (next() % 4);
    const bass = 36 + (next() % 24);
    const notes = [bass];
    for (let n = 1; n < size; n++) notes.push(notes[n - 1] + 1 + (next() % 7));
    yield notes;
  }
}

const corpus = [...(fixtures as { midi: number[] }[]).map((f) => f.midi), ...randomVoicings(3000)];

describe('symbol round trip', () => {
  it('parses every displayed reading back to itself', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const midi of corpus) {
      for (const reading of detectChord(midi, 10).readings) {
        checked++;
        try {
          const parsed = parseSymbol(reading.symbol);
          const same =
            parsed.rootPc === reading.rootPc &&
            parsed.quality === reading.quality &&
            parsed.tensions.join(',') === reading.tensions.join(',') &&
            (parsed.bassPc ?? reading.rootPc) === reading.bassPc;
          if (!same) failures.push(`${reading.symbol} → ${JSON.stringify(parsed)}`);
        } catch (error) {
          failures.push(`${reading.symbol}: ${(error as Error).message}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
    expect(Array.from(new Set(failures)).slice(0, 20)).toEqual([]);
  });
});
