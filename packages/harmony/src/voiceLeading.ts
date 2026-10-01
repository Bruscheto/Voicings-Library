/**
 * Voice-leading cost and least-movement paths through a progression.
 */

import { normalizeNotes } from './pitch';

/** Cost of adding or dropping one voice between chords, in semitones. */
const VOICE_CHANGE_PENALTY = 3;

/**
 * Total semitone movement between two voicings. Voices are matched in order
 * (no crossing); with unequal sizes the extra voices of the larger chord are
 * the ones left unmatched, each charged a fixed penalty.
 */
export function voiceLeadingCost(from: readonly number[], to: readonly number[]): number {
  const [small, large] = from.length <= to.length
    ? [normalizeNotes(from), normalizeNotes(to)]
    : [normalizeNotes(to), normalizeNotes(from)];
  const n = small.length;
  const m = large.length;
  // best[i][j]: cost of matching small[0..i) into large[0..j).
  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  for (let j = 0; j <= m; j++) best[0][j] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = i; j <= m; j++) {
      const match = best[i - 1][j - 1] + Math.abs(small[i - 1] - large[j - 1]);
      best[i][j] = Math.min(best[i][j - 1], match);
    }
  }
  return best[n][m] + (m - n) * VOICE_CHANGE_PENALTY;
}

export type Path<T> = { steps: T[]; cost: number };

/**
 * Choose one option per step to minimise total voice movement (Viterbi).
 * Pin a step by passing a single option for it.
 */
export function solvePath<T>(options: readonly (readonly T[])[], notesOf: (option: T) => readonly number[]): Path<T> | null {
  if (options.length === 0 || options.some((step) => step.length === 0)) return null;
  let costs = options[0].map(() => 0);
  const back: number[][] = [];
  for (let s = 1; s < options.length; s++) {
    const pointers: number[] = [];
    const previousCosts = costs;
    costs = options[s].map((option) => {
      let bestCost = Infinity;
      let bestIndex = 0;
      options[s - 1].forEach((previous, p) => {
        const cost = previousCosts[p] + voiceLeadingCost(notesOf(previous), notesOf(option));
        if (cost < bestCost) {
          bestCost = cost;
          bestIndex = p;
        }
      });
      pointers.push(bestIndex);
      return bestCost;
    });
    back.push(pointers);
  }

  let index = costs.indexOf(Math.min(...costs));
  const cost = costs[index];
  const chosen = [index];
  for (let s = back.length - 1; s >= 0; s--) {
    index = back[s][index];
    chosen.unshift(index);
  }
  return { steps: chosen.map((i, s) => options[s][i]), cost };
}
