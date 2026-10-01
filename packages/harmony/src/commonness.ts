/**
 * How often a chord name is written in jazz charts, independent of the notes
 * played. Counts come from the iRealPro Corpus of Jazz Standards (Shanahan &
 * Broze, https://doi.org/10.5281/zenodo.3546040, CC BY 4.0), rebuilt with
 * `pnpm run harmony:prior <corpus dir>`.
 *
 * Quality and tensions are separate features: charts write G7 where pianists
 * play G13, so written tensions under-count played ones, and detect.ts weighs
 * the two independently.
 */

import prior from './data/chord-prior.json';
import { BASE_QUALITIES, type BaseQuality } from './qualities';

type Counts = Partial<Record<string, number>>;

const qualityCounts = prior.quality as Counts;
const tensionCounts = prior.tensions as Partial<Record<string, Counts>>;
const total = BASE_QUALITIES.reduce((sum, q) => sum + (qualityCounts[q] ?? 0), 0);

/** log P(quality) over all written chords, add-one smoothed. */
export function logPQuality(quality: BaseQuality): number {
  return Math.log(((qualityCounts[quality] ?? 0) + 1) / (total + BASE_QUALITIES.length));
}

/** Sum of log P(tension written | quality), add-one smoothed per tension. */
export function logPTensions(quality: BaseQuality, tensions: readonly string[]): number {
  const n = qualityCounts[quality] ?? 0;
  const counts = tensionCounts[quality] ?? {};
  return tensions.reduce((sum, t) => sum + Math.log(((counts[t] ?? 0) + 1) / (n + 2)), 0);
}
