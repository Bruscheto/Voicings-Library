#!/usr/bin/env ts-node

/**
 * Re-run the chord engine over every stored voicing. Structure tags are
 * engine-derived, so this refreshes them after a migration or a classifier
 * change. It also re-checks every stored reading:
 *   - tensions the notes do not match are corrected to what the notes spell;
 *   - readings the notes cannot support are reported, never deleted;
 *   - a voicing with no reading gets the engine's top reading as primary.
 * Reports only, unless --write is passed.
 */

import chalk from 'chalk';
import { prisma } from '../packages/data-model/src';
import { realizeVoicing } from '../packages/data-model/src/voicing';
import {
  classifyStructure,
  detectChord,
  isBaseQuality,
  mod12,
  readAs,
  type BaseQuality,
} from '../packages/harmony/src';

type Change =
  | { kind: 'structure'; voicingId: string; structure: string[] }
  | { kind: 'tensions'; readingId: string; tensions: string[]; rootless: boolean }
  | {
      kind: 'primary';
      voicingId: string;
      rootOffset: number;
      quality: BaseQuality;
      tensions: string[];
      rootless: boolean;
    };

const sameList = (a: readonly string[], b: readonly string[]) => a.join(',') === b.join(',');

async function main(write: boolean) {
  const voicings = await prisma.voicing.findMany({
    include: { readings: true },
    orderBy: { createdAt: 'asc' },
  });
  const changes: Change[] = [];
  const problems: string[] = [];

  for (const voicing of voicings) {
    const { midi, pitches } = realizeVoicing(voicing);
    const label = `${voicing.name ?? voicing.id} (${pitches.join(' ')})`;
    const bassPc = mod12(voicing.bassMidi);
    let primary = voicing.readings.find((r) => r.isPrimary) ?? null;

    for (const stored of voicing.readings) {
      const rootPc = bassPc + stored.rootOffset;
      const reading = isBaseQuality(stored.quality) ? readAs(midi, rootPc, stored.quality) : null;
      const shown = realizeVoicing({ ...voicing, readings: [stored] }).primary?.symbol;
      if (!reading) {
        problems.push(`${label}: stored reading ${shown} is not supported by the notes`);
        if (stored.isPrimary) primary = null;
        continue;
      }
      if (!sameList(reading.tensions, stored.tensions) || reading.rootless !== stored.rootless) {
        changes.push({
          kind: 'tensions',
          readingId: stored.id,
          tensions: reading.tensions,
          rootless: reading.rootless,
        });
        console.log(`${label}: ${shown} → tensions [${reading.tensions.join(', ')}]`);
      }
    }

    let structureChord: { rootPc: number; quality: BaseQuality } | null = null;
    if (primary && isBaseQuality(primary.quality)) {
      structureChord = { rootPc: bassPc + primary.rootOffset, quality: primary.quality };
    } else if (!voicing.readings.length) {
      const [top] = detectChord(midi).readings;
      if (!top) {
        problems.push(`${label}: no chord reading`);
        continue;
      }
      changes.push({
        kind: 'primary',
        voicingId: voicing.id,
        rootOffset: mod12(top.rootPc - bassPc),
        quality: top.quality,
        tensions: top.tensions,
        rootless: top.rootless,
      });
      console.log(`${label}: no reading → primary ${top.symbol}`);
      structureChord = top;
    }
    if (!structureChord) continue;

    const structure = classifyStructure(midi, structureChord);
    if (!sameList(structure, voicing.structure)) {
      changes.push({ kind: 'structure', voicingId: voicing.id, structure });
      console.log(
        `${label}: structure [${voicing.structure.join(', ')}] → [${structure.join(', ')}]`,
      );
    }
  }

  for (const problem of problems) console.log(chalk.yellow(problem));
  console.log(
    `\n${voicings.length} voicings, ${changes.length} changes, ${problems.length} problems to review by hand.`,
  );
  if (!write) {
    console.log(chalk.gray('Report only. Pass --write to apply the changes.'));
    return;
  }

  await prisma.$transaction(
    changes.map((change) => {
      if (change.kind === 'structure') {
        return prisma.voicing.update({
          where: { id: change.voicingId },
          data: { structure: change.structure },
        });
      }
      if (change.kind === 'tensions') {
        return prisma.voicingReading.update({
          where: { id: change.readingId },
          data: { tensions: change.tensions, rootless: change.rootless },
        });
      }
      const { kind: _kind, ...reading } = change;
      return prisma.voicingReading.create({ data: { ...reading, isPrimary: true } });
    }),
  );
  console.log(chalk.green(`Applied ${changes.length} changes.`));
}

main(process.argv.includes('--write'))
  .catch((err) => {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
