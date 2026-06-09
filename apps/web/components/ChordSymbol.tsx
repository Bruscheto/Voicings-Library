import { chordSegments } from 'data-model';

interface ChordSymbolProps {
  root: string;
  quality: string;
  tensions: string[];
  slashBass: string | null;
  className?: string;
}

/**
 * Renders a chord name with a tiny visual gap between segments
 * (root · quality · tensions · slash) for readability.
 *
 * Storage stays as a single joined string (`buildSymbol`); this component
 * is the source of truth for how that name appears to humans.
 */
export function ChordSymbol({
  root,
  quality,
  tensions,
  slashBass,
  className,
}: ChordSymbolProps) {
  const segments = chordSegments(root, quality, tensions, slashBass);
  const wrapperClass = className
    ? `inline-flex items-baseline gap-0.5 ${className}`
    : 'inline-flex items-baseline gap-0.5';

  return (
    <span className={wrapperClass}>
      {segments.map((text, i) => (
        <span key={i}>{text}</span>
      ))}
    </span>
  );
}
