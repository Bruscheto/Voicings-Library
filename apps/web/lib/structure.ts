// Engine structure tags (harmony's classifyStructure) as shown to people.
// Close and open describe spacing rather than a technique, so they stay hidden.

export const STRUCTURE_LABEL: Record<string, string> = {
  shell: 'Shell',
  'rootless-a': 'Rootless A',
  'rootless-b': 'Rootless B',
  quartal: 'Quartal',
  ust: 'Upper structure',
  drop2: 'Drop 2',
  drop3: 'Drop 3',
  close: 'Close',
  open: 'Open',
};

/** Shown structures, most specific first; also the Finder's grouping order. */
export const STRUCTURE_ORDER = [
  'rootless-a',
  'rootless-b',
  'shell',
  'drop2',
  'drop3',
  'quartal',
  'ust',
];

export function visibleStructures(tags: readonly string[]): string[] {
  return STRUCTURE_ORDER.filter((tag) => tags.includes(tag));
}
