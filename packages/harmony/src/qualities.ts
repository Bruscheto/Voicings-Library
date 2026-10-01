/**
 * Base chord qualities: the skeletons the detector matches and the storage
 * vocabulary (see canonicalize.ts). Extensions are never a quality here —
 * they are tensions over one of these skeletons.
 *
 * Families follow Woodshed's harmony model (api/app/theory/harmony.py): what
 * a chord means to an improviser, independent of its exact extensions.
 */

export type BaseQuality =
  | 'Maj'
  | 'Maj7'
  | '6'
  | 'min'
  | 'min7'
  | 'm6'
  | 'mMaj7'
  | '7'
  | '7sus4'
  | 'sus4'
  | 'sus2'
  | 'dim'
  | 'dim7'
  | 'm7b5'
  | 'aug'
  | 'aug7';

export type Family = 'maj7' | '6' | 'm7' | 'm6' | '7' | '7alt' | 'm7b5' | 'dim7' | 'sus' | 'aug';

export type ChordRole = 'root' | 'third' | 'fifth' | 'seventh';

export type QualityDef = {
  name: BaseQuality;
  /** Chord tones as semitones above the root, keyed to their role and label. */
  tones: Record<number, { role: ChordRole; label: string }>;
  /** Tones that must sound for this reading to be considered. */
  essential: number[];
  /** Legal tensions by interval. */
  tensions: Record<number, string>;
  /** Legal but clashing tensions (natural 11 over a major 3rd). */
  avoid: string[];
  family: Family;
};

const R = { role: 'root', label: 'R' } as const;
const M3 = { role: 'third', label: '3' } as const;
const m3 = { role: 'third', label: 'b3' } as const;
const P5 = { role: 'fifth', label: '5' } as const;
const b5 = { role: 'fifth', label: 'b5' } as const;
const s5 = { role: 'fifth', label: '#5' } as const;
const M7 = { role: 'seventh', label: '7' } as const;
const b7 = { role: 'seventh', label: 'b7' } as const;
const six = { role: 'seventh', label: '6' } as const;

const DEFS: QualityDef[] = [
  {
    name: 'Maj',
    tones: { 0: R, 4: M3, 7: P5 },
    essential: [4],
    tensions: { 2: '9', 5: '11', 6: '#11', 9: '13' },
    avoid: ['11'],
    family: '6',
  },
  {
    name: 'Maj7',
    tones: { 0: R, 4: M3, 7: P5, 11: M7 },
    essential: [4, 11],
    tensions: { 2: '9', 5: '11', 6: '#11', 9: '13' },
    avoid: ['11'],
    family: 'maj7',
  },
  {
    name: '6',
    tones: { 0: R, 4: M3, 7: P5, 9: six },
    essential: [4, 9],
    tensions: { 2: '9', 5: '11', 6: '#11' },
    avoid: ['11'],
    family: '6',
  },
  {
    name: 'min',
    tones: { 0: R, 3: m3, 7: P5 },
    essential: [3],
    tensions: { 2: '9', 5: '11', 8: 'b13', 9: '13' },
    avoid: [],
    family: 'm6',
  },
  {
    name: 'min7',
    tones: { 0: R, 3: m3, 7: P5, 10: b7 },
    essential: [3, 10],
    // b13 is aeolian colour, outside the dorian sound Woodshed's m7 family plays.
    tensions: { 2: '9', 5: '11', 8: 'b13', 9: '13' },
    avoid: ['b13'],
    family: 'm7',
  },
  {
    name: 'm6',
    tones: { 0: R, 3: m3, 7: P5, 9: six },
    essential: [3, 9],
    tensions: { 2: '9', 5: '11' },
    avoid: [],
    family: 'm6',
  },
  {
    name: 'mMaj7',
    tones: { 0: R, 3: m3, 7: P5, 11: M7 },
    essential: [3, 11],
    tensions: { 2: '9', 5: '11', 9: '13' },
    avoid: [],
    family: 'm6',
  },
  {
    name: '7',
    tones: { 0: R, 4: M3, 7: P5, 10: b7 },
    essential: [4, 10],
    tensions: { 1: 'b9', 2: '9', 3: '#9', 5: '11', 6: '#11', 8: 'b13', 9: '13' },
    avoid: ['11'],
    family: '7',
  },
  {
    name: '7sus4',
    tones: { 0: R, 5: { role: 'third', label: '4' }, 7: P5, 10: b7 },
    essential: [5, 10],
    tensions: { 1: 'b9', 2: '9', 9: '13' },
    avoid: [],
    family: 'sus',
  },
  {
    name: 'sus4',
    tones: { 0: R, 5: { role: 'third', label: '4' }, 7: P5 },
    essential: [5],
    tensions: { 2: '9', 9: '13' },
    avoid: [],
    family: 'sus',
  },
  {
    name: 'sus2',
    tones: { 0: R, 2: { role: 'third', label: '2' }, 7: P5 },
    essential: [2],
    tensions: { 9: '13' },
    avoid: [],
    family: 'sus',
  },
  {
    name: 'dim',
    tones: { 0: R, 3: m3, 6: b5 },
    essential: [3, 6],
    tensions: { 2: '9', 5: '11', 8: 'b13' },
    avoid: [],
    family: 'dim7',
  },
  {
    name: 'dim7',
    tones: { 0: R, 3: m3, 6: b5, 9: { role: 'seventh', label: 'bb7' } },
    essential: [3, 6, 9],
    tensions: { 2: '9', 5: '11', 8: 'b13' },
    avoid: [],
    family: 'dim7',
  },
  {
    name: 'm7b5',
    tones: { 0: R, 3: m3, 6: b5, 10: b7 },
    essential: [3, 6, 10],
    tensions: { 2: '9', 5: '11', 8: 'b13' },
    avoid: [],
    family: 'm7b5',
  },
  {
    name: 'aug',
    tones: { 0: R, 4: M3, 8: s5 },
    essential: [4, 8],
    tensions: { 2: '9', 6: '#11' },
    avoid: [],
    family: 'aug',
  },
  {
    name: 'aug7',
    tones: { 0: R, 4: M3, 8: s5, 10: b7 },
    essential: [4, 8, 10],
    tensions: { 1: 'b9', 2: '9', 3: '#9', 6: '#11' },
    avoid: [],
    family: 'aug',
  },
];

export const QUALITIES: Record<BaseQuality, QualityDef> = Object.fromEntries(
  DEFS.map((def) => [def.name, def]),
) as Record<BaseQuality, QualityDef>;

/** Detection order; earlier wins ties (simpler, more common readings first). */
export const BASE_QUALITIES: BaseQuality[] = DEFS.map((def) => def.name);

const ALTERED = new Set(['b9', '#9', 'b13']);

export function isBaseQuality(value: string): value is BaseQuality {
  return value in QUALITIES;
}

/** The improviser's family: a dominant with b9/#9/b13 plays altered. */
export function familyOf(quality: BaseQuality, tensions: readonly string[]): Family {
  const { family } = QUALITIES[quality];
  return family === '7' && tensions.some((t) => ALTERED.has(t)) ? '7alt' : family;
}

/** Tension name → interval above the root for this quality. */
export function tensionInterval(quality: BaseQuality, tension: string): number | undefined {
  const entry = Object.entries(QUALITIES[quality].tensions).find(([, name]) => name === tension);
  return entry ? Number(entry[0]) : undefined;
}

export function hasSeventh(quality: BaseQuality): boolean {
  return Object.values(QUALITIES[quality].tones).some((tone) => tone.role === 'seventh');
}
