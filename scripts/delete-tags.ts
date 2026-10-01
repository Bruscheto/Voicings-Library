#!/usr/bin/env ts-node

/**
 * Delete tags by exact name, with their voicing links. Report only unless
 * --write is passed.
 *
 * Usage: pnpm run tags:delete "Drop 2" Quartal Rootless [--write]
 */

import chalk from 'chalk';
import { prisma } from '../packages/data-model/src';

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const names = args.filter((arg) => arg !== '--write');
  if (names.length === 0) throw new Error('Name at least one tag to delete.');

  const tags = await prisma.tag.findMany({
    where: { name: { in: names } },
    include: { voicings: { include: { voicing: { select: { name: true } } } } },
  });
  const missing = names.filter((name) => !tags.some((t) => t.name === name));
  for (const tag of tags) {
    const on = tag.voicings.map((v) => v.voicing.name ?? 'unnamed').join(', ') || 'no voicings';
    console.log(`${JSON.stringify(tag.name)}: ${tag.voicings.length} link(s) (${on})`);
  }
  if (missing.length) console.log(chalk.yellow(`Not found: ${missing.join(', ')}`));
  if (!write || tags.length === 0) {
    console.log(chalk.green('\nReport only. Pass --write to delete.'));
    return;
  }

  const ids = tags.map((t) => t.id);
  const [links, deleted] = await prisma.$transaction([
    prisma.voicingTag.deleteMany({ where: { tagId: { in: ids } } }),
    prisma.tag.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(chalk.green(`\nDeleted ${deleted.count} tag(s) and ${links.count} link(s).`));
}

main()
  .catch((error) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
