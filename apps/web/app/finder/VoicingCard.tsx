'use client';

import Link from 'next/link';
import { isBaseQuality, midiToPitch, spellVoicing, type PitchClass } from 'harmony';
import { MiniKeyboard } from 'keyboard';

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

type Props = {
  id: string;
  name: string | null;
  symbol: string;
  midi: number[];
  rootPc: PitchClass;
  quality: string;
  tensions: string[];
  structure: string[];
  badge?: string;
  onPlay: (midi: number[]) => void;
};

export function VoicingCard({
  id,
  name,
  symbol,
  midi,
  rootPc,
  quality,
  tensions,
  structure,
  badge,
  onPlay,
}: Props) {
  const chord = isBaseQuality(quality) ? { rootPc, quality, tensions } : null;
  const pitches = chord ? spellVoicing(midi, chord) : midi.map(midiToPitch);
  return (
    <article className="voicing-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/voicings/${id}?root=${rootPc}`} className="voicing-card-title">
            {symbol}
          </Link>
          {name && <p className="text-sm text-gray-500">{name}</p>}
        </div>
        <button
          type="button"
          onClick={() => onPlay(midi)}
          aria-label={`Play ${symbol}`}
          className="secondary-button !min-h-9 !px-3 !text-xs"
        >
          Play
        </button>
      </div>
      <div className="keyboard-preview">
        <MiniKeyboard notes={midi} chord={chord} className="h-16 w-full max-w-[280px]" />
      </div>
      <p className="font-mono text-xs text-gray-500">{pitches.join(' ')}</p>
      <div className="flex flex-wrap gap-1.5">
        {badge && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            {badge}
          </span>
        )}
        {structure
          .filter((tag) => tag !== 'close' && tag !== 'open')
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
            >
              {STRUCTURE_LABEL[tag] ?? tag}
            </span>
          ))}
      </div>
    </article>
  );
}
