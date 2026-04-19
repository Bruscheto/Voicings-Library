#!/usr/bin/env ts-node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import chalk from 'chalk';
import { PrismaClient } from '@prisma/client';

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
  midi_numbers: string;
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

const REQUIRED_FIELDS: (keyof SeedRow)[] = ['voicing_id', 'symbol', 'root', 'quality', 'pitches', 'midi_numbers', 'status'];

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
    escape: '\\'
  });
  return records as SeedRow[];
}

function validateRow(row: SeedRow, index: number) {
  const missing = REQUIRED_FIELDS.filter(field => !row[field] && row[field] !== '');
  if (missing.length > 0) {
    throw new Error(`Row ${index + 2} is missing required fields: ${missing.join(', ')}`);
  }

  if (!['ready', 'draft', 'defer'].includes(row.status)) {
    throw new Error(`Row ${index + 2} has invalid status '${row.status}'`);
  }

  try {
    JSON.parse(row.pitches);
    JSON.parse(row.midi_numbers);
  } catch (err) {
    throw new Error(`Row ${index + 2} has invalid JSON in pitches/midi_numbers`);
  }
}

function parseContext(row: SeedRow) {
  const slash = row.slash_bass?.trim();
  const tags = row.context_tags?.split(',').map(tag => tag.trim()).filter(Boolean) ?? [];
  // Store as comma separated for now.
  const parts = [];
  if (slash) parts.push(`slash:${slash}`);
  if (tags.length) parts.push(`tags:${tags.join('|')}`);
  return parts.join(';');
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
      console.log(chalk.gray(`[Dry Run] Would upsert chord ${row.symbol} and voicing ${row.voicing_id}`));
      continue;
    }

    const chord = await prisma.chord.upsert({
      where: { symbol: row.symbol },
      update: {},
      create: {
        symbol: row.symbol,
        quality: row.quality,
        root: row.root,
        tensions: row.tensions ?? null
      }
    });

    stats.chordsUpserted++;

    const context = parseContext(row) || null;

    await prisma.voicing.upsert({
      where: { id: row.voicing_id },
      update: {
        name: row.voicing_name ?? null,
        pitches: row.pitches,
        midiNumbers: row.midi_numbers,
        chords: {
          upsert: {
            where: {
              voicingId_chordId: {
                voicingId: row.voicing_id,
                chordId: chord.id
              }
            },
            update: {
              context
            },
            create: {
              chordId: chord.id,
              context
            }
          }
        }
      },
      create: {
        id: row.voicing_id,
        name: row.voicing_name ?? null,
        pitches: row.pitches,
        midiNumbers: row.midi_numbers,
        chords: {
          create: {
            chordId: chord.id,
            context
          }
        }
      }
    });

    stats.voicingsUpserted++;
  }

  return stats;
}

export async function importVoicingsFromCsv(csvPath: string, options: { dryRun?: boolean } = {}): Promise<ImportStats> {
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
    const csvPath = args.find(arg => !arg.startsWith('--')) ?? 'docs/data/voicings-seed.csv';
    const dryRun = args.includes('--dry-run');

    if (!csvPath) usage();

    const stats = await importVoicingsFromCsv(csvPath, { dryRun });

    console.log(chalk.green(`\nImport complete.`));
    console.log(`Chords upserted: ${stats.chordsUpserted}`);
    console.log(`Voicings upserted: ${stats.voicingsUpserted}`);
    console.log(`Rows skipped (non-ready): ${stats.skippedRows}`);
  })()
    .catch(err => {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    })
    .finally(async () => {
      await closeImporterPrisma();
    });
}
