import { STRUCTURE_LABEL, visibleStructures } from '../lib/structure';

type Props = { structure: readonly string[]; size?: 'sm' | 'md' };

export function StructureChips({ structure, size = 'sm' }: Props) {
  const tags = visibleStructures(structure);
  if (tags.length === 0) return null;
  const text = size === 'sm' ? 'px-2 text-[11px]' : 'px-2.5 text-xs';
  return (
    <>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`rounded-full bg-gray-100 py-0.5 font-medium text-gray-700 ${text}`}
        >
          {STRUCTURE_LABEL[tag]}
        </span>
      ))}
    </>
  );
}
