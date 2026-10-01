'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  degreesOf,
  isBaseQuality,
  mod12,
  nearestBass,
  pcName,
  realizeVoicing,
  type LibraryVoicing,
} from 'harmony';
import { MiniKeyboard, StaffPreview, usePiano, type PianoStatus } from 'keyboard';
import { StructureChips } from '../../../components/StructureChips';

const KEYS = Array.from({ length: 12 }, (_, pc) => pc);
const PIANO_LABEL: Record<PianoStatus, string> = {
  loading: 'Loading piano…',
  ready: 'Piano ready',
  partial: 'Piano partial',
  synth: 'Synth fallback',
  unavailable: 'Audio unavailable',
};

type Props = {
  voicing: LibraryVoicing;
  initialRoot: number | null;
  collections: string[];
  tags: string[];
  source: string | null;
};

export function VoicingView({ voicing, initialRoot, collections, tags, source }: Props) {
  const router = useRouter();
  const piano = usePiano();
  const [arpeggio, setArpeggio] = useState(false);
  const primaryReading = voicing.readings.find((r) => r.isPrimary) ?? voicing.readings[0] ?? null;
  const authoredRoot = mod12(voicing.bassMidi + (primaryReading?.rootOffset ?? 0));
  const [rootPc, setRootPc] = useState(initialRoot ?? authoredRoot);

  const view = useMemo(() => {
    const bass = nearestBass(voicing.bassMidi, rootPc - (primaryReading?.rootOffset ?? 0));
    return realizeVoicing(voicing, bass);
  }, [voicing, rootPc, primaryReading]);
  const { midi, pitches, primary, readings } = view;
  const chord =
    primary && isBaseQuality(primary.quality)
      ? { rootPc, quality: primary.quality, tensions: primary.tensions }
      : null;
  const degrees = chord ? degreesOf(midi, chord) : [];

  const changeKey = (pc: number) => {
    setRootPc(pc);
    router.replace(`?root=${pc}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="page-heading !mb-2 flex flex-col gap-3">
        <h1>{primary?.symbol ?? 'Unnamed chord'}</h1>
        {voicing.name && <p className="text-gray-500">{voicing.name}</p>}
        <div className="flex flex-wrap gap-1.5">
          <StructureChips structure={voicing.structure} size="md" />
          {collections.map((c) => (
            <span
              key={c}
              className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
            >
              {c}
            </span>
          ))}
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-600"
            >
              {t}
            </span>
          ))}
        </div>
      </header>

      <section aria-label="Key" className="key-selector">
        {KEYS.map((pc) => (
          <button key={pc} type="button" aria-pressed={pc === rootPc} onClick={() => changeKey(pc)}>
            {pcName(pc)}
          </button>
        ))}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <span className="font-mono text-sm text-gray-600">{pitches.join(' ')}</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {PIANO_LABEL[piano.status]}
          </span>
        </div>
        <div className="detail-instrument grid gap-8 md:grid-cols-2">
          <StaffPreview notes={midi} chord={chord} />
          <div className="flex flex-col justify-center gap-4">
            <MiniKeyboard notes={midi} chord={chord} className="h-20 w-full" />
            <ol className="flex flex-wrap gap-1.5" aria-label="Notes and degrees">
              {degrees.map((d) => (
                <li
                  key={d.midi}
                  className={`flex items-baseline gap-1.5 rounded-md border px-2 py-1 ${
                    d.isGuideTone ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-surface'
                  }`}
                >
                  <span className="font-mono text-xs text-gray-500">
                    {pitches[midi.indexOf(d.midi)]}
                  </span>
                  <span
                    className={`text-sm font-bold ${d.isGuideTone ? 'text-amber-700' : 'text-emerald-700'}`}
                  >
                    {d.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-amber-700">Guide tones</span> carry the
              chord&apos;s sound: the 3rd (4th on sus chords) and the 7th (or 6th).
            </p>
          </div>
        </div>
        <div className="detail-controls flex items-center justify-end gap-5 border-t border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={arpeggio}
              onChange={(e) => setArpeggio(e.target.checked)}
            />
            Arpeggio
          </label>
          <button
            type="button"
            onClick={() => void piano.play(midi, arpeggio)}
            className="primary-button"
          >
            Play
          </button>
        </div>
      </section>

      {readings.length > 1 && (
        <section>
          <h2 className="section-heading mb-4">Also reads as</h2>
          <ul className="flex flex-wrap gap-2">
            {readings.slice(1).map((r) => (
              <li
                key={r.symbol}
                className="rounded-md border border-gray-200 bg-surface px-3 py-1.5 font-semibold"
              >
                {r.symbol}
                {r.rootless && (
                  <span className="ml-2 text-xs font-normal text-gray-500">rootless</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {source && <p className="text-sm text-gray-500">Source: {source}</p>}
    </div>
  );
}
