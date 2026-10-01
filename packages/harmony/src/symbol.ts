/**
 * Chord symbol → storage chord. Accepts the spellings found on real charts
 * (Cmaj7, CΔ7, C-7, Cø, Bb13(#11), C7alt, F6/9, Ebmaj7/G) and rejects
 * anything it cannot name exactly, so a typo never silently matches.
 */

import { toBase } from './canonicalize';
import { noteToPc, pcName, type PitchClass } from './pitch';
import { QUALITIES, isBaseQuality, type BaseQuality } from './qualities';

export type ParsedSymbol = {
  rootPc: PitchClass;
  root: string;
  quality: BaseQuality;
  tensions: string[];
  bassPc: PitchClass | null;
  /** "7alt": any altered dominant; tensions are left to the voicing. */
  altered: boolean;
};

type QualityToken = { quality: string; tensions?: string[]; altered?: boolean };

const TOKENS: Record<string, QualityToken> = {
  '': { quality: 'Maj' }, maj: { quality: 'Maj' }, Maj: { quality: 'Maj' }, M: { quality: 'Maj' }, 'Δ': { quality: 'Maj' },
  maj7: { quality: 'Maj7' }, Maj7: { quality: 'Maj7' }, M7: { quality: 'Maj7' }, 'Δ7': { quality: 'Maj7' },
  maj9: { quality: 'Maj9' }, Maj9: { quality: 'Maj9' }, M9: { quality: 'Maj9' }, 'Δ9': { quality: 'Maj9' },
  maj13: { quality: 'Maj13' }, Maj13: { quality: 'Maj13' }, M13: { quality: 'Maj13' }, 'Δ13': { quality: 'Maj13' },
  '6': { quality: '6' }, '69': { quality: '6/9' }, '6/9': { quality: '6/9' },
  add9: { quality: 'Maj', tensions: ['9'] },
  m: { quality: 'min' }, min: { quality: 'min' }, '-': { quality: 'min' },
  madd9: { quality: 'min', tensions: ['9'] },
  m6: { quality: 'm6' }, min6: { quality: 'm6' }, '-6': { quality: 'm6' },
  m69: { quality: 'min6/9' }, 'm6/9': { quality: 'min6/9' }, 'min6/9': { quality: 'min6/9' },
  m7: { quality: 'min7' }, min7: { quality: 'min7' }, '-7': { quality: 'min7' },
  m9: { quality: 'min9' }, min9: { quality: 'min9' }, '-9': { quality: 'min9' },
  m11: { quality: 'min11' }, min11: { quality: 'min11' }, '-11': { quality: 'min11' },
  m13: { quality: 'min13' }, min13: { quality: 'min13' }, '-13': { quality: 'min13' },
  mMaj7: { quality: 'mMaj7' }, mM7: { quality: 'mMaj7' }, 'm(maj7)': { quality: 'mMaj7' }, '-Δ7': { quality: 'mMaj7' },
  '7': { quality: '7' }, '9': { quality: '9' }, '13': { quality: '13' },
  '11': { quality: '9sus4' },
  '7alt': { quality: '7', altered: true }, alt: { quality: '7', altered: true },
  '7sus4': { quality: '7sus4' }, '7sus': { quality: '7sus4' },
  '9sus4': { quality: '9sus4' }, '9sus': { quality: '9sus4' },
  '13sus4': { quality: '13sus4' }, '13sus': { quality: '13sus4' },
  sus4: { quality: 'sus4' }, sus: { quality: 'sus4' }, sus2: { quality: 'sus2' },
  m7b5: { quality: 'm7b5' }, min7b5: { quality: 'm7b5' }, '-7b5': { quality: 'm7b5' }, 'ø': { quality: 'm7b5' }, 'ø7': { quality: 'm7b5' },
  dim: { quality: 'dim' }, o: { quality: 'dim' }, '°': { quality: 'dim' },
  dim7: { quality: 'dim7' }, o7: { quality: 'dim7' }, '°7': { quality: 'dim7' },
  aug: { quality: 'aug' }, '+': { quality: 'aug' },
  aug7: { quality: 'aug7' }, '+7': { quality: 'aug7' }, '7#5': { quality: 'aug7' }, '7+5': { quality: 'aug7' }, '7+': { quality: 'aug7' },
};

// Longest first, so "m7b5" wins over "m7" and "maj13" over "maj".
const TOKEN_KEYS = Object.keys(TOKENS).sort((a, b) => b.length - a.length);

const ROOT_RE = /^([A-G](?:#|b)?)(.*)$/;
const SLASH_RE = /^(.*)\/([A-G](?:#|b)?)$/;
const TENSION_RE = /(?:add)?([b#]?)(5|9|11|13)/y;

export function parseSymbol(input: string): ParsedSymbol {
  const text = input.trim().replace(/\s+/g, '');
  const rootMatch = ROOT_RE.exec(text);
  if (!rootMatch) throw new Error(`not a chord symbol: ${JSON.stringify(input)}`);
  const rootPc = noteToPc(rootMatch[1]);

  let rest = rootMatch[2];
  let bassPc: PitchClass | null = null;
  const slash = SLASH_RE.exec(rest);
  if (slash) {
    rest = slash[1];
    bassPc = noteToPc(slash[2]);
  }

  const key = TOKEN_KEYS.find((k) => rest.startsWith(k));
  const token = TOKENS[key ?? ''];
  let quality = token.quality;
  const tensions = [...(token.tensions ?? [])];
  for (const t of parseTensions(rest.slice((key ?? '').length), input)) {
    if (t === '#5' && quality === '7') quality = 'aug7';
    else if (t === 'b5' && quality === '7') tensions.push('#11');
    else tensions.push(t);
  }

  const base = toBase(quality, tensions);
  if (!isBaseQuality(base.quality)) throw new Error(`unsupported chord quality in ${JSON.stringify(input)}`);
  const legal = new Set(Object.values(QUALITIES[base.quality].tensions));
  const illegal = base.tensions.filter((t) => !legal.has(t));
  if (illegal.length) throw new Error(`${illegal.join(', ')} is not a tension on ${JSON.stringify(input)}`);

  return {
    rootPc,
    root: pcName(rootPc),
    quality: base.quality,
    tensions: base.tensions,
    bassPc: bassPc === rootPc ? null : bassPc,
    altered: token.altered ?? false,
  };
}

function parseTensions(text: string, input: string): string[] {
  const body = text.replace(/[(),]/g, '');
  const tensions: string[] = [];
  let index = 0;
  while (index < body.length) {
    TENSION_RE.lastIndex = index;
    const m = TENSION_RE.exec(body);
    if (!m) throw new Error(`cannot read ${JSON.stringify(body.slice(index))} in ${JSON.stringify(input)}`);
    tensions.push(`${m[1]}${m[2]}`);
    index = TENSION_RE.lastIndex;
  }
  return tensions;
}

export function isSymbol(input: string): boolean {
  try {
    parseSymbol(input);
    return true;
  } catch {
    return false;
  }
}
