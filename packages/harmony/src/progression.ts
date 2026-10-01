/**
 * Voice-led paths: choose one stored voicing per chord of a progression so
 * the hands move as little as possible, with any step pinnable by the player.
 */

import { readingSymbol, type LibraryVoicing } from './finder';
import { mod12, type PitchClass } from './pitch';
import type { BaseQuality } from './qualities';
import { placeShape, type Range } from './shape';
import { solvePath, voiceLeadingCost } from './voiceLeading';
import type { StoredReading } from './voicing';

export type StepSpec = {
  /** Roman numeral, e.g. "ii", "V7", "Imaj7". */
  label: string;
  rootPc: PitchClass;
  /** Any of these qualities fits the step, in order of preference. */
  qualities: BaseQuality[];
  /** Only dominants whose tensions are all altered. */
  altered?: boolean;
};

export type PathOption = {
  /** Stable across re-solves: which voicing, at which bass. */
  key: string;
  voicing: LibraryVoicing;
  reading: StoredReading;
  midi: number[];
  symbol: string;
};

export type PathStep = {
  spec: StepSpec;
  chosen: PathOption;
  /** Other options, smoothest first given the chosen neighbours. */
  alternatives: PathOption[];
  /** Movement from the previous chord, in semitones; 0 for the first. */
  movement: number;
};

export type PathResult =
  /** movement: total semitones the voices travel (register cost excluded). */
  { ok: true; steps: PathStep[]; movement: number } | { ok: false; missing: StepSpec[] };

export type Mode = 'major' | 'minor';

/** Comfortable comping register: G2 to G5. */
export const DEFAULT_RANGE: Range = { low: 43, high: 79 };
// Within the range, voicings centred near middle C sound clearest: low
// close intervals turn muddy, high ones thin. Drift beyond a dead zone costs
// a fraction of a semitone of movement per semitone of drift.
const REGISTER_CENTRE = 62;
const REGISTER_DEAD_ZONE = 4;
const REGISTER_WEIGHT = 0.5;

export function registerCost(midi: readonly number[]): number {
  const centre = midi.reduce((sum, n) => sum + n, 0) / midi.length;
  return Math.max(0, Math.abs(centre - REGISTER_CENTRE) - REGISTER_DEAD_ZONE) * REGISTER_WEIGHT;
}
const MAX_ALTERNATIVES = 8;
const ALTERED = new Set(['b9', '#9', '#11', 'b13']);

export function twoFiveOne(keyPc: PitchClass, mode: Mode): StepSpec[] {
  const ii = mod12(keyPc + 2);
  const v = mod12(keyPc + 7);
  return mode === 'major'
    ? [
        { label: 'ii', rootPc: ii, qualities: ['min7'] },
        { label: 'V7', rootPc: v, qualities: ['7'] },
        { label: 'Imaj7', rootPc: mod12(keyPc), qualities: ['Maj7', '6'] },
      ]
    : [
        { label: 'iiø', rootPc: ii, qualities: ['m7b5'] },
        { label: 'V7alt', rootPc: v, qualities: ['7'], altered: true },
        { label: 'i', rootPc: mod12(keyPc), qualities: ['m6', 'mMaj7', 'min7'] },
      ];
}

function fits(reading: StoredReading, spec: StepSpec): boolean {
  if (!spec.qualities.includes(reading.quality as BaseQuality)) return false;
  return (
    !spec.altered || (reading.tensions.length > 0 && reading.tensions.every((t) => ALTERED.has(t)))
  );
}

/** Every placement of every stored voicing that can play this step. */
export function stepOptions(
  library: readonly LibraryVoicing[],
  spec: StepSpec,
  range: Range,
): PathOption[] {
  const options: PathOption[] = [];
  for (const voicing of library) {
    const reading = voicing.readings.find((r) => fits(r, spec));
    if (!reading) continue;
    for (const midi of placeShape(voicing.intervals, spec.rootPc - reading.rootOffset, range)) {
      options.push({
        key: `${voicing.id}@${midi[0]}`,
        voicing,
        reading,
        midi,
        symbol: readingSymbol(reading, spec.rootPc),
      });
    }
  }
  return options;
}

const movementAround = (option: PathOption, prev?: PathOption, next?: PathOption) =>
  (prev ? voiceLeadingCost(prev.midi, option.midi) : 0) +
  (next ? voiceLeadingCost(option.midi, next.midi) : 0) +
  registerCost(option.midi);

/**
 * Least total movement through the steps. `pins[i]` fixes step i to the
 * option with that key, when it is still available.
 */
export function buildPath(
  library: readonly LibraryVoicing[],
  specs: readonly StepSpec[],
  pins: readonly (string | null)[] = [],
  range: Range = DEFAULT_RANGE,
): PathResult {
  const all = specs.map((spec) => stepOptions(library, spec, range));
  const missing = specs.filter((_, i) => all[i].length === 0);
  if (missing.length) return { ok: false, missing };

  const constrained = all.map((options, i) => {
    const pinned = pins[i] && options.find((o) => o.key === pins[i]);
    return pinned ? [pinned] : options;
  });
  const path = solvePath(
    constrained,
    (o) => o.midi,
    (o) => registerCost(o.midi),
  )!;

  const steps = path.steps.map((chosen, i): PathStep => {
    const prev = path.steps[i - 1];
    const next = path.steps[i + 1];
    const alternatives = all[i]
      .filter((o) => o.key !== chosen.key)
      .sort((a, b) => movementAround(a, prev, next) - movementAround(b, prev, next))
      .slice(0, MAX_ALTERNATIVES);
    return {
      spec: specs[i],
      chosen,
      alternatives,
      movement: prev ? voiceLeadingCost(prev.midi, chosen.midi) : 0,
    };
  });
  return { ok: true, steps, movement: steps.reduce((sum, s) => sum + s.movement, 0) };
}
