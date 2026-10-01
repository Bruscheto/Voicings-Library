#!/usr/bin/env ts-node

/**
 * Download the piano samples the library plays (see packages/keyboard/src/
 * pianoSamples.ts) into apps/web/public/samples/piano, in both formats smplr
 * may request: Opus (ogg) and AAC (m4a, for Safari). The Splendid Grand Piano
 * samples are public domain (Akai). Existing files are skipped.
 *
 * Usage: pnpm run piano:samples
 */

import fs from 'node:fs';
import path from 'node:path';
import { PIANO_SAMPLE_FILES } from '../packages/keyboard/src/pianoSamples';

const SOURCE = 'https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples';
const OUT_DIR = path.resolve(__dirname, '../apps/web/public/samples/piano');
const FORMATS = ['ogg', 'm4a'];

async function download(name: string, format: string): Promise<'saved' | 'skipped'> {
  const file = path.join(OUT_DIR, `${name}.${format}`);
  if (fs.existsSync(file)) return 'skipped';
  const response = await fetch(`${SOURCE}/${encodeURIComponent(`${name}.${format}`)}`);
  if (!response.ok) throw new Error(`${name}.${format}: HTTP ${response.status}`);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return 'saved';
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jobs = PIANO_SAMPLE_FILES.flatMap((name) =>
    FORMATS.map((format) => download(name, format)),
  );
  const results = await Promise.all(jobs);
  const saved = results.filter((r) => r === 'saved').length;
  const bytes = fs
    .readdirSync(OUT_DIR)
    .filter((f) => FORMATS.some((format) => f.endsWith(`.${format}`)))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(
    `${PIANO_SAMPLE_FILES.length} samples × ${FORMATS.length} formats: ${saved} downloaded, ${results.length - saved} already present (${Math.round(bytes / 1024)} KB in ${path.relative(process.cwd(), OUT_DIR)})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
