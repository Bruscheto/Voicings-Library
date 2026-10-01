'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  buildPath,
  isBaseQuality,
  midiToPitch,
  pcName,
  twoFiveOne,
  type LibraryVoicing,
  type Mode,
  type PathOption,
  type PathStep,
} from 'harmony';
import { MiniKeyboard, StaffPreview, usePiano } from 'keyboard';

const KEYS = Array.from({ length: 12 }, (_, pc) => pc);
const DEFAULT_BPM = 80;
const MS_PER_MINUTE = 60_000;
const BEATS_PER_CHORD = 2;

const parseKey = (value: string | null) => {
  const key = Number(value);
  return Number.isInteger(key) && key >= 0 && key < 12 ? key : 0;
};

const chordOf = (option: PathOption, rootPc: number) =>
  isBaseQuality(option.reading.quality) ? { rootPc, quality: option.reading.quality } : null;

export function PathBuilder({ library }: { library: LibraryVoicing[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [keyPc, setKeyPc] = useState(() => parseKey(params.get('key')));
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'minor' ? 'minor' : 'major');
  const [pins, setPins] = useState<(string | null)[]>([null, null, null]);
  const [openStep, setOpenStep] = useState<number | null>(null);
  const piano = usePiano();

  const specs = useMemo(() => twoFiveOne(keyPc, mode), [keyPc, mode]);
  const path = useMemo(() => buildPath(library, specs, pins), [library, specs, pins]);

  const update = (nextKey: number, nextMode: Mode) => {
    setKeyPc(nextKey);
    setMode(nextMode);
    setPins([null, null, null]);
    setOpenStep(null);
    router.replace(`/paths?key=${nextKey}&mode=${nextMode}`, { scroll: false });
  };
  const pin = (step: number, key: string | null) => {
    setPins((prev) => prev.map((p, i) => (i === step ? key : p)));
    setOpenStep(null);
  };
  const playPath = (steps: PathStep[]) =>
    void piano.playSequence(
      steps.map((s) => s.chosen.midi),
      (MS_PER_MINUTE / DEFAULT_BPM) * BEATS_PER_CHORD,
    );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" aria-label="Key">
          {KEYS.map((pc) => (
            <button
              key={pc}
              type="button"
              aria-pressed={pc === keyPc}
              onClick={() => update(pc, mode)}
              className={`w-11 rounded-md border py-1.5 text-sm font-semibold transition ${
                pc === keyPc
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {pcName(pc)}
            </button>
          ))}
        </div>
        <div
          className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium"
          role="radiogroup"
          aria-label="Mode"
        >
          {(['major', 'minor'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => update(keyPc, m)}
              className={`rounded-md px-4 py-1.5 capitalize ${mode === m ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      {!path.ok ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="font-medium text-gray-900">
            The library has no voicing yet for{' '}
            {path.missing
              .map(
                (s) =>
                  `${s.label} (${pcName(s.rootPc)}${s.altered ? '7alt' : ` ${s.qualities.join(' / ')}`})`,
              )
              .join(', ')}
            .
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Capture one in any key and it will appear here in every key.
          </p>
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Total movement: <strong className="text-gray-900">{path.movement} semitones</strong>
            </p>
            <button
              type="button"
              onClick={() => playPath(path.steps)}
              className="rounded-md bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Play ii–V–I
            </button>
          </div>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {path.steps.map((step, i) => (
              <li
                key={step.spec.label}
                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-sm font-semibold text-gray-500">
                    {step.spec.label}
                  </span>
                  {i > 0 && <span className="text-xs text-gray-500">moves {step.movement}</span>}
                </div>
                <Link
                  href={`/voicings/${step.chosen.voicing.id}?root=${step.spec.rootPc}`}
                  className="text-2xl font-semibold hover:underline"
                >
                  {step.chosen.symbol}
                </Link>
                <StaffPreview notes={step.chosen.midi} className="min-h-[200px]" />
                <MiniKeyboard
                  notes={step.chosen.midi}
                  chord={chordOf(step.chosen, step.spec.rootPc)}
                />
                <p className="font-mono text-xs text-gray-500">
                  {step.chosen.midi.map(midiToPitch).join(' ')}
                </p>
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => void piano.play(step.chosen.midi, false)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    aria-expanded={openStep === i}
                    disabled={step.alternatives.length === 0}
                    onClick={() => setOpenStep(openStep === i ? null : i)}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-40"
                  >
                    Swap ({step.alternatives.length})
                  </button>
                  {pins[i] && (
                    <button
                      type="button"
                      onClick={() => pin(i, null)}
                      className="ml-auto text-xs text-gray-500 hover:text-gray-900"
                    >
                      Unpin
                    </button>
                  )}
                </div>
                {openStep === i && (
                  <ul className="flex flex-col divide-y divide-gray-100 rounded-md border border-gray-200">
                    {step.alternatives.map((option) => (
                      <li key={option.key}>
                        <button
                          type="button"
                          onClick={() => pin(i, option.key)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="w-28 shrink-0 text-sm font-semibold">
                            {option.symbol}
                          </span>
                          <MiniKeyboard
                            notes={option.midi}
                            chord={chordOf(option, step.spec.rootPc)}
                            className="h-7 w-full max-w-[160px]"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
