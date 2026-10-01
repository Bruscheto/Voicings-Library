#!/usr/bin/env ts-node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import chalk from 'chalk';
import { pitchToMidi } from '../packages/harmony/src/pitch';
import { prisma } from '../packages/data-model/src';
import {
  analyzeVoicing,
  realizeVoicing,
  type VoicingAnalysis,
} from '../packages/data-model/src/voicing';

type SeedRow = {
  pitches: string;
  symbols?: string;
  name?: string;
  tags?: string;
  source?: string;
  status: string;
  notes?: string;
};

type Status = 'ready' | 'draft' | 'defer';

type CheckedRow = {
  line: number;
  row: SeedRow;
  /** null when the row's status is not one of STATUSES. */
  status: Status | null;
  analysis: VoicingAnalysis | null;
  error: string | null;
};

export type ImportStats = {
  readyRows: number;
  voicingsUpserted: number;
  skippedRows: number;
};

const STATUSES: Status[] = ['ready', 'draft', 'defer'];
// CSV line of the first data row: header is line 1.
const FIRST_DATA_LINE = 2;

function loadCsv(csvPath: string): SeedRow[] {
  const absolute = path.resolve(csvPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`CSV file not found: ${absolute}`);
  }
  const records = parse(fs.readFileSync(absolute, 'utf8'), {
    columns: true,
    skipEmptyLines: true,
    bom: true,
    trim: true,
  });
  return records as SeedRow[];
}

const splitList = (raw: string | undefined, separator: string): string[] =>
  (raw ?? '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);

function checkRow(row: SeedRow, index: number): CheckedRow {
  const line = index + FIRST_DATA_LINE;
  if (!STATUSES.includes(row.status as Status)) {
    return { line, row, status: null, analysis: null, error: `invalid status '${row.status}'` };
  }
  const status = row.status as Status;
  try {
    const midi = splitList(row.pitches, ' ').map(pitchToMidi);
    const analysis = analyzeVoicing(midi, splitList(row.symbols, ';'));
    return { line, row, status, analysis, error: null };
  } catch (error) {
    return {
      line,
      row,
      status,
      analysis: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Two ready rows with the same shape would overwrite each other. */
function duplicateShapeErrors(rows: CheckedRow[]): string[] {
  const seen = new Map<string, number>();
  const errors: string[] = [];
  for (const { line, status, analysis } of rows) {
    if (status !== 'ready' || !analysis) continue;
    const first = seen.get(analysis.shape.shapeKey);
    if (first !== undefined)
      errors.push(`line ${line}: same shape as line ${first} (${analysis.shape.shapeKey})`);
    else seen.set(analysis.shape.shapeKey, line);
  }
  return errors;
}

function describe(checked: CheckedRow): string {
  const label = `line ${checked.line} [${checked.status ?? checked.row.status}] ${checked.row.pitches}`;
  if (!checked.analysis) return `${label} → ${chalk.red(checked.error)}`;
  const view = realizeVoicing({ ...checked.analysis.shape, readings: checked.analysis.readings });
  const readings = view.readings.map((r) => r.symbol).join(' · ');
  const source = checked.row.symbols?.trim() ? 'authored' : 'detected';
  return `${label} → ${readings} (${source}) [${checked.analysis.structure.join(', ')}]`;
}

async function resolveTagIds(names: string[]): Promise<string[]> {
  return Promise.all(
    names.map(async (name) => {
      const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
      return tag.id;
    }),
  );
}

// Readings are replaced from the CSV; tags are only added, so collection
// memberships made in the capture app survive a re-import.
async function writeRow({
  row,
  analysis,
}: CheckedRow & { analysis: VoicingAnalysis }): Promise<void> {
  const { shape, structure, readings } = analysis;
  const fields = {
    name: row.name?.trim() || null,
    intervals: shape.intervals,
    bassMidi: shape.bassMidi,
    structure,
    status: 'ready',
    source: row.source?.trim() || null,
  };
  const tagIds = await resolveTagIds(splitList(row.tags, ','));
  await prisma.$transaction(async (tx) => {
    const voicing = await tx.voicing.upsert({
      where: { shapeKey: shape.shapeKey },
      update: fields,
      create: { ...fields, shapeKey: shape.shapeKey },
    });
    await tx.voicingReading.deleteMany({ where: { voicingId: voicing.id } });
    await tx.voicingReading.createMany({
      data: readings.map((r) => ({ ...r, voicingId: voicing.id })),
    });
    await tx.voicingTag.createMany({
      data: tagIds.map((tagId) => ({ voicingId: voicing.id, tagId })),
      skipDuplicates: true,
    });
  });
}

export async function importVoicingsFromCsv(
  csvPath: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportStats> {
  const checked = loadCsv(csvPath).map(checkRow);
  for (const row of checked) console.log(describe(row));

  const errors = [
    ...checked
      .filter((c) => c.error && (c.status === 'ready' || c.status === null))
      .map((c) => `line ${c.line}: ${c.error}`),
    ...duplicateShapeErrors(checked),
  ];
  if (errors.length) {
    throw new Error(`Seed rows failed validation; nothing was written.\n${errors.join('\n')}`);
  }

  const ready = checked.filter(
    (c): c is CheckedRow & { analysis: VoicingAnalysis } => c.status === 'ready' && !!c.analysis,
  );
  const stats: ImportStats = {
    readyRows: ready.length,
    voicingsUpserted: 0,
    skippedRows: checked.length - ready.length,
  };
  if (options.dryRun) return stats;

  for (const row of ready) {
    await writeRow(row);
    stats.voicingsUpserted++;
  }
  return stats;
}

export async function closeImporterPrisma() {
  await prisma.$disconnect();
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const csvPath = args.find((arg) => !arg.startsWith('--')) ?? 'docs/data/voicings-seed.csv';
    const dryRun = args.includes('--dry-run');

    const stats = await importVoicingsFromCsv(csvPath, { dryRun });

    console.log(
      chalk.green(`\n${dryRun ? 'Dry run complete; nothing was written.' : 'Import complete.'}`),
    );
    console.log(
      dryRun
        ? `Voicings to upsert: ${stats.readyRows}`
        : `Voicings upserted: ${stats.voicingsUpserted}`,
    );
    console.log(`Rows skipped (draft or defer): ${stats.skippedRows}`);
  })()
    .catch((err) => {
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeImporterPrisma();
    });
}
