import { degreesOf, type ChordRef } from 'harmony';

const WHITE_WIDTH = 12;
const WHITE_HEIGHT = 44;
const BLACK_WIDTH = 8;
const BLACK_HEIGHT = 27;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const OCTAVE = 12;

type Props = {
  notes: number[];
  /** Colour guide tones and label degrees against this chord. */
  chord?: ChordRef | null;
  className?: string;
};

/**
 * A small static keyboard spanning the voicing (whole octaves, C to B), with
 * played keys filled and guide tones in amber. For result lists and cards.
 */
export function MiniKeyboard({ notes, chord, className = 'h-11 w-full max-w-[260px]' }: Props) {
  if (notes.length === 0) return null;
  const low = Math.floor(Math.min(...notes) / OCTAVE) * OCTAVE;
  const high = Math.ceil((Math.max(...notes) + 1) / OCTAVE) * OCTAVE - 1;
  const degrees = new Map(chord ? degreesOf(notes, chord).map((d) => [d.midi, d]) : []);
  const played = new Set(notes);

  const whites: { midi: number; x: number }[] = [];
  const blacks: { midi: number; x: number }[] = [];
  for (let midi = low; midi <= high; midi++) {
    if (BLACK_PCS.has(midi % OCTAVE))
      blacks.push({ midi, x: whites.length * WHITE_WIDTH - BLACK_WIDTH / 2 });
    else whites.push({ midi, x: whites.length * WHITE_WIDTH });
  }
  const fill = (midi: number, black: boolean) => {
    if (!played.has(midi))
      return black ? 'var(--keyboard-black, #111827)' : 'var(--keyboard-white, #ffffff)';
    return degrees.get(midi)?.isGuideTone
      ? 'var(--keyboard-guide, #f59e0b)'
      : 'var(--keyboard-note, #9333ea)';
  };
  const width = whites.length * WHITE_WIDTH;
  const label = notes
    .map((n) => degrees.get(n)?.label)
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${WHITE_HEIGHT}`}
      className={className}
      role="img"
      aria-label={label ? `Keyboard: ${label}` : 'Keyboard'}
    >
      {whites.map(({ midi, x }) => (
        <rect
          key={midi}
          x={x}
          y={0}
          width={WHITE_WIDTH}
          height={WHITE_HEIGHT}
          rx={1.5}
          fill={fill(midi, false)}
          stroke="var(--keyboard-border, #d1d5db)"
        />
      ))}
      {blacks.map(({ midi, x }) => (
        <rect
          key={midi}
          x={x}
          y={0}
          width={BLACK_WIDTH}
          height={BLACK_HEIGHT}
          rx={1}
          fill={fill(midi, true)}
        />
      ))}
    </svg>
  );
}
