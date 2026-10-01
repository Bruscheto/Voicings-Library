/**
 * How common a chord name is in jazz charts, independent of the notes played.
 * Hand-authored log weights (natural log of rough relative frequency in lead
 * sheets), then scaled by PRIOR_WEIGHT in detect.ts, which was fitted on the
 * author-labelled seed. Only the ordering and rough gaps matter: dominant and
 * minor sevenths dominate, sixths and half-diminished are everyday, add-style
 * colours (Maj6add11, min(b13)) are rare.
 */

import type { BaseQuality } from './qualities';

const QUALITY: Record<BaseQuality, number> = {
  '7': Math.log(0.3),
  min7: Math.log(0.25),
  Maj7: Math.log(0.12),
  '6': Math.log(0.12),
  Maj: Math.log(0.1),
  m7b5: Math.log(0.05),
  min: Math.log(0.04),
  dim7: Math.log(0.03),
  m6: Math.log(0.03),
  '7sus4': Math.log(0.025),
  aug7: Math.log(0.01),
  mMaj7: Math.log(0.008),
  aug: Math.log(0.005),
  sus4: Math.log(0.005),
  dim: Math.log(0.004),
  sus2: Math.log(0.003),
};

// Cost of each tension on top of its quality. 0 is free, -3 is almost never written.
const COMMON = -0.3;
const USUAL = -0.8;
const UNUSUAL = -1.5;
const RARE = -2.5;
const AVOID = -3;

const TENSION: Record<BaseQuality, Record<string, number>> = {
  Maj7: { '9': COMMON, '#11': USUAL, '13': USUAL, '11': AVOID },
  '6': { '9': COMMON, '#11': UNUSUAL, '11': AVOID },
  Maj: { '9': USUAL, '#11': RARE, '11': AVOID },
  min7: { '9': COMMON, '11': USUAL, '13': UNUSUAL, b13: RARE },
  min: { '9': USUAL, '11': RARE, b13: RARE },
  m6: { '9': COMMON, '11': RARE },
  mMaj7: { '9': COMMON, '11': UNUSUAL, '13': UNUSUAL },
  '7': {
    '9': COMMON,
    '13': COMMON,
    b9: USUAL,
    '#9': USUAL,
    b13: USUAL,
    '#11': USUAL,
    '11': AVOID,
  },
  '7sus4': { '9': COMMON, '13': USUAL, b9: UNUSUAL },
  sus4: { '9': USUAL, '13': RARE },
  sus2: { '13': RARE },
  dim: { '9': RARE, '11': RARE, b13: RARE },
  dim7: { '9': UNUSUAL, '11': UNUSUAL, b13: RARE },
  m7b5: { '9': USUAL, '11': USUAL, b13: UNUSUAL },
  aug: { '9': UNUSUAL, '#11': UNUSUAL },
  aug7: { '9': USUAL, b9: UNUSUAL, '#9': UNUSUAL, '#11': UNUSUAL },
};

/** Log prior of a chord name (base quality + tension set). */
export function logPrior(quality: BaseQuality, tensions: readonly string[]): number {
  return tensions.reduce((sum, t) => sum + (TENSION[quality][t] ?? RARE), QUALITY[quality]);
}
