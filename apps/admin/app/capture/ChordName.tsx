import { chordSegments, type Reading } from 'harmony';

type Props = {
  reading: Pick<Reading, 'root' | 'quality' | 'tensions' | 'rootPc' | 'bassPc' | 'bass'>;
  className?: string;
};

/** A reading's display symbol with a hair of space between its segments. */
export function ChordName({ reading, className = '' }: Props) {
  const slash = reading.bassPc === reading.rootPc ? null : reading.bass;
  return (
    <span className={`inline-flex items-baseline gap-0.5 ${className}`}>
      {chordSegments(reading.root, reading.quality, reading.tensions, slash).map((segment, i) => (
        <span key={i}>{segment}</span>
      ))}
    </span>
  );
}
