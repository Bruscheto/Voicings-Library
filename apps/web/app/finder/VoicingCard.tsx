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
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            href={`/voicings/${id}?root=${rootPc}`}
            className="text-xl font-semibold text-gray-900 hover:underline"
          >
            {symbol}
          </Link>
          {name && <p className="text-sm text-gray-500">{name}</p>}
        </div>
        <button
          type="button"
          onClick={() => onPlay(midi)}
          aria-label={`Play ${symbol}`}
          className="rounded-full bg-emerald-700 p-2 text-white hover:bg-emerald-800"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
            <path d="M6.3 3.6a1 1 0 0 0-1.5.87v11.06a1 1 0 0 0 1.5.87l9.4-5.53a1 1 0 0 0 0-1.74L6.3 3.6Z" />
          </svg>
        </button>
      </div>
      <MiniKeyboard notes={midi} chord={chord} />
      <p className="font-mono text-xs text-gray-500">{pitches.join(' ')}</p>
      <div className="flex flex-wrap gap-1.5">
        {badge && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
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
