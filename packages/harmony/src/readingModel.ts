/**
 * The reading model: each candidate reading of a set of notes is described by
 * a few named features, and its score is their weighted sum. Probabilities
 * are the softmax of scores over all candidates. The weights are fitted by
 * `pnpm run harmony:train` (scripts/train-reading-model.ts) on synthetic
 * voicings of chords sampled from the jazz corpus prior.
 */

import weights from './data/reading-weights.json';

export const FEATURE_NAMES = [
  'guideTones', // 3rds and 7ths (or 6ths) sounding
  'chordTones', // roots and 5ths sounding
  'tensions', // tensions sounding
  'avoidTensions', // tensions that clash with the quality (natural 11 over a major 3rd)
  'rootPresent',
  'missingFifth', // root present, 5th absent
  'thinVoicing', // root present, 5th absent, only three pitch classes
  'completeRootless', // root absent but a 9th or 13th completes the sound
  'thinRootless', // root absent with under four pitch classes
  'rareRootless', // rootless minor-6 or minor-major
  'shellUnderneath', // root in the bass with its 3rd and 7th as the next two notes up
  'bassRoot',
  'bassThird',
  'bassFifth',
  'bassSeventh',
  'bassTension', // a tension, or a major 7th (a b9 against the root above)
  'logPQuality', // how often the quality is written in jazz charts
  'logPTensions', // how often its tensions are written on that quality
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type Features = Record<FeatureName, number>;
export type Weights = Record<FeatureName, number>;

export const READING_WEIGHTS = weights as Weights;

export function emptyFeatures(): Features {
  return Object.fromEntries(FEATURE_NAMES.map((name) => [name, 0])) as Features;
}

export function scoreFeatures(features: Features, w: Weights = READING_WEIGHTS): number {
  return FEATURE_NAMES.reduce((sum, name) => sum + w[name] * features[name], 0);
}
