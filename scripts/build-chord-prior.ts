#!/usr/bin/env ts-node

/**
 * Count how often each chord quality and tension is written in the iRealPro
 * Corpus of Jazz Standards and write the counts the harmony engine uses as
 * its commonness prior.
 *
 * Usage: pnpm run harmony:prior <path to unzipped iRb_v1-0 directory>
 * Corpus: Shanahan & Broze, https://doi.org/10.5281/zenodo.3546040 (CC BY 4.0).
 */

import fs from 'node:fs';
import path from 'node:path';
import type { BaseQuality } from '../packages/harmony/src/qualities';

type Mapped = { quality: BaseQuality; tensions: string[] };

const OUT = path.resolve(__dirname, '../packages/harmony/src/data/chord-prior.json');
const ALTERED = ['b9', '#9', 'b13'];

// iRealPro **jazz quality spellings → base quality + tension set.
const QUALITY_MAP: Record<string, Mapped> = {
  '': { quality: 'Maj', tensions: [] },
  maj: { quality: 'Maj', tensions: [] },
  add9: { quality: 'Maj', tensions: ['9'] },
  '6': { quality: '6', tensions: [] },
  '69': { quality: '6', tensions: ['9'] },
  maj7: { quality: 'Maj7', tensions: [] },
  '^': { quality: 'Maj7', tensions: [] },
  maj9: { quality: 'Maj7', tensions: ['9'] },
  '^9': { quality: 'Maj7', tensions: ['9'] },
  'maj7#11': { quality: 'Maj7', tensions: ['#11'] },
  '^9#11': { quality: 'Maj7', tensions: ['9', '#11'] },
  min: { quality: 'min', tensions: [] },
  minb6: { quality: 'min', tensions: ['b13'] },
  min6: { quality: 'm6', tensions: [] },
  min69: { quality: 'm6', tensions: ['9'] },
  min7: { quality: 'min7', tensions: [] },
  min9: { quality: 'min7', tensions: ['9'] },
  min11: { quality: 'min7', tensions: ['9', '11'] },
  'min:maj7': { quality: 'mMaj7', tensions: [] },
  h7: { quality: 'm7b5', tensions: [] },
  h: { quality: 'm7b5', tensions: [] },
  min7b5: { quality: 'm7b5', tensions: [] },
  o7: { quality: 'dim7', tensions: [] },
  o: { quality: 'dim', tensions: [] },
  '+': { quality: 'aug', tensions: [] },
  '7': { quality: '7', tensions: [] },
  '9': { quality: '7', tensions: ['9'] },
  '13': { quality: '7', tensions: ['9', '13'] },
  '7b9': { quality: '7', tensions: ['b9'] },
  '7#9': { quality: '7', tensions: ['#9'] },
  '7#11': { quality: '7', tensions: ['#11'] },
  '7b5': { quality: '7', tensions: ['#11'] },
  '7b13': { quality: '7', tensions: ['b13'] },
  '9#11': { quality: '7', tensions: ['9', '#11'] },
  '13b9': { quality: '7', tensions: ['b9', '13'] },
  '13#11': { quality: '7', tensions: ['9', '#11', '13'] },
  '7b9b13': { quality: '7', tensions: ['b9', 'b13'] },
  '7b9#11': { quality: '7', tensions: ['b9', '#11'] },
  '7b9b5': { quality: '7', tensions: ['b9', '#11'] },
  '7#9b5': { quality: '7', tensions: ['#9', '#11'] },
  '7alt': { quality: '7', tensions: ALTERED },
  '7#5': { quality: 'aug7', tensions: [] },
  '9#5': { quality: 'aug7', tensions: ['9'] },
  '7#9#5': { quality: 'aug7', tensions: ['#9'] },
  '7b9#5': { quality: 'aug7', tensions: ['b9'] },
  '7sus': { quality: '7sus4', tensions: [] },
  '9sus': { quality: '7sus4', tensions: ['9'] },
  '13sus': { quality: '7sus4', tensions: ['9', '13'] },
  '7b9sus': { quality: '7sus4', tensions: ['b9'] },
  sus: { quality: 'sus4', tensions: [] },
};

// Duration, root (kern flats are "-"), optional ":", quality, then an
// optional slash bass and parenthesised alternate chord, both ignored.
const TOKEN_RE = /^[0-9.]*([A-G][-#]*):?([^/(;]*)/;

export type ChordPrior = {
  source: string;
  license: string;
  tunes: number;
  chords: number;
  unmapped: Record<string, number>;
  quality: Partial<Record<BaseQuality, number>>;
  tensions: Partial<Record<BaseQuality, Record<string, number>>>;
  /** Whole chord names, "quality|tension,tension", for sampling training chords. */
  names: Record<string, number>;
};

function chordTokens(file: string): string[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[!*=]/.test(line) && !/^[0-9.]*r$/.test(line));
}

export function buildPrior(corpusDir: string): ChordPrior {
  const files = fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith('.jazz'))
    .map((f) => path.join(corpusDir, f));
  if (files.length === 0) throw new Error(`No .jazz files in ${corpusDir}`);

  const prior: ChordPrior = {
    source:
      'iRealPro Corpus of Jazz Standards v1.0, Daniel Shanahan & Yuri Broze, https://doi.org/10.5281/zenodo.3546040',
    license: 'CC BY 4.0',
    tunes: files.length,
    chords: 0,
    unmapped: {},
    quality: {},
    tensions: {},
    names: {},
  };
  for (const token of files.flatMap(chordTokens)) {
    const match = TOKEN_RE.exec(token);
    const mapped = match ? QUALITY_MAP[match[2]] : undefined;
    if (!mapped) {
      const key = match ? match[2] : token;
      prior.unmapped[key] = (prior.unmapped[key] ?? 0) + 1;
      continue;
    }
    prior.chords++;
    prior.quality[mapped.quality] = (prior.quality[mapped.quality] ?? 0) + 1;
    const counts = (prior.tensions[mapped.quality] ??= {});
    for (const t of mapped.tensions) counts[t] = (counts[t] ?? 0) + 1;
    const name = `${mapped.quality}|${mapped.tensions.join(',')}`;
    prior.names[name] = (prior.names[name] ?? 0) + 1;
  }
  return prior;
}

if (require.main === module) {
  const corpusDir = process.argv[2];
  if (!corpusDir) {
    console.error('Usage: pnpm run harmony:prior <path to iRb_v1-0>');
    process.exit(1);
  }
  const prior = buildPrior(path.resolve(corpusDir));
  const unmappedTotal = Object.values(prior.unmapped).reduce((a, b) => a + b, 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(prior, null, 2)}\n`);
  console.log(
    `${prior.tunes} tunes, ${prior.chords} chords mapped, ${unmappedTotal} unmapped → ${path.relative(process.cwd(), OUT)}`,
  );
}
