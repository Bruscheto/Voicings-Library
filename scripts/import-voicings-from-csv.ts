#!/usr/bin/env ts-node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import chalk from 'chalk';
import { PrismaClient } from '@prisma/client';
import { toBase, canonicalizeChord, buildSymbol } from '../packages/data-model/src/canonicalize';

type SeedRow = {
  voicing_id: string;
  voicing_name?: string;
  symbol: string;
  root: string;
  quality: string;
  tensions?: string;
  slash_bass?: string;
  context_tags?: string;
  pitches: string;
  midi_numbers?: string;
  register_low?: string;
  register_high?: string;
  clef_hint?: string;
  descriptor?: string;
  substructures?: string;
  tags?: string;
  progression_refs?: string;
  audio_status?: string;
  notes?: string;
  source?: string;
  status: string;
};

export type ImportStats = {
  chordsUpserted: number;
  voicingsUpserted: number;
  skippedRows: number;
};

const prisma = new PrismaClient();

const REQUIRED_FIELDS: (keyof SeedRow)[] = [
  'voicing_id',
  'symbol',
  'root',
  'quality',
  'pitches',
  'status',
];

function loadCsv(csvPath: string): SeedRow[] {
  const absolute = path.resolve(csvPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`CSV file not found: ${absolute}`);
  }
  const raw = fs.readFileSync(absolute, 'utf8');
  const records = parse(raw, {
    columns: true,
    skipEmptyLines: true,
    bom: true,
    trim: true,
    escape: '\\',
  });
  return records as SeedRow[];
}

function validateRow(row: SeedRow, index: number) {
  const missing = REQUIRED_FIELDS.filter((field) => !row[field] && row[field] !== '');
  if (missing.length > 0) {
    throw new Error(`Row ${index + 2} is missing required fields: ${missing.join(', ')}`);
  }

  if (!['ready', 'draft', 'defer'].includes(row.status)) {
    throw new Error(`Row ${index + 2} has invalid status '${row.status}'`);
  }

  try {
    JSON.parse(row.pitches);
  } catch (err) {
    throw new Error(`Row ${index + 2} has invalid JSON in pitches`);
  }
}

function parsePitches(raw: string): string[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('pitches must be a JSON array');
  return parsed.map(String);
}

function parseTensions(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseTagNames(row: SeedRow): string[] {
  return (
    row.context_tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

async function resolveTagIds(names: string[]): Promise<string[]> {
  return Promise.all(
    names.map(async (name) => {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      return tag.id;
    }),
  );
}

async function processRows(rows: SeedRow[], dryRun: boolean): Promise<ImportStats> {
  const stats: ImportStats = { chordsUpserted: 0, voicingsUpserted: 0, skippedRows: 0 };

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    validateRow(row, index);

    if (row.status !== 'ready') {
      stats.skippedRows++;
      continue;
    }

    if (dryRun) {
      console.log(
        chalk.gray(`[Dry Run] Would upsert chord ${row.symbol} and voicing ${row.voicing_id}`),
      );
      continue;
    }

    const slashBass = row.slash_bass?.trim() || null;
    const rawTensions = parseTensions(row.tensions);
    const base = toBase(row.quality, rawTensions);
    const display = canonicalizeChord(row.quality, rawTensions);
    const displaySymbol = buildSymbol(row.root, display.quality, display.tensions, slashBass);
    const pitchesArr = parsePitches(row.pitches);

    const chord = await prisma.chord.upsert({
      where: { symbol: displaySymbol },
      update: {},
      create: {
        symbol: displaySymbol,
        quality: base.quality,
        root: row.root,
        tensions: base.tensions,
      },
    });

    stats.chordsUpserted++;

    const tagIds = await resolveTagIds(parseTagNames(row));

    await prisma.voicing.upsert({
      where: { id: row.voicing_id },
      update: {
        name: row.voicing_name ?? null,
        pitches: pitchesArr,
        slashBass,
        chords: {
          upsert: {
            where: {
              voicingId_chordId: {
                voicingId: row.voicing_id,
                chordId: chord.id,
              },
            },
            update: {},
            create: { chordId: chord.id },
          },
        },
        tags: {
          deleteMany: {},
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
      create: {
        id: row.voicing_id,
        name: row.voicing_name ?? null,
        pitches: pitchesArr,
        slashBass,
        chords: { create: { chordId: chord.id } },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });

    stats.voicingsUpserted++;
  }

  return stats;
}

export async function importVoicingsFromCsv(
  csvPath: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportStats> {
  const rows = loadCsv(csvPath);
  return processRows(rows, options.dryRun ?? false);
}

export async function closeImporterPrisma() {
  await prisma.$disconnect();
}

function usage(): never {
  console.log(`Usage: ts-node scripts/import-voicings-from-csv.ts <csvPath> [--dry-run]`);
  process.exit(1);
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const csvPath = args.find((arg) => !arg.startsWith('--')) ?? 'docs/data/voicings-seed.csv';
    const dryRun = args.includes('--dry-run');

    if (!csvPath) usage();

    const stats = await importVoicingsFromCsv(csvPath, { dryRun });

    console.log(chalk.green(`\nImport complete.`));
    console.log(`Chords upserted: ${stats.chordsUpserted}`);
    console.log(`Voicings upserted: ${stats.voicingsUpserted}`);
    console.log(`Rows skipped (non-ready): ${stats.skippedRows}`);
  })()
    .catch((err) => {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    })
    .finally(async () => {
      await closeImporterPrisma();
    });
}
