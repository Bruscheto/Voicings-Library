'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  buildPath,
  isBaseQuality,
  midiToPitch,
  pcName,
  spellVoicing,
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
  isBaseQuality(option.reading.quality)
    ? { rootPc, quality: option.reading.quality, tensions: option.reading.tensions }
    : null;

const spellNames = (option: PathOption, rootPc: number) => {
  const chord = chordOf(option, rootPc);
  return (chord ? spellVoicing(option.midi, chord) : option.midi.map(midiToPitch)).join(' ');
};

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
      <section className="panel path-toolbar">
        <div>
          <span className="field-label">Key</span>
          <div className="key-selector" aria-label="Key">
            {KEYS.map((pc) => (
              <button
                key={pc}
                type="button"
                aria-pressed={pc === keyPc}
                onClick={() => update(pc, mode)}
              >
                {pcName(pc)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="field-label">Mode</span>
          <div className="segmented-control" role="radiogroup" aria-label="Mode">
            {(['major', 'minor'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => update(keyPc, m)}
                className="capitalize"
                tabIndex={mode === m ? 0 : -1}
                onKeyDown={(event) => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 'major'
                      : event.key === 'End'
                        ? 'minor'
                        : mode === 'major'
                          ? 'minor'
                          : 'major';
                  update(keyPc, next);
                  const radios =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                      '[role="radio"]',
                    );
                  radios?.[next === 'major' ? 0 : 1].focus();
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!path.ok ? (
        <section className="empty-state">
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
          <div className="path-actions">
            <p className="text-sm text-gray-600">
              Total movement: <strong className="text-gray-900">{path.movement} semitones</strong>
            </p>
            <button type="button" onClick={() => playPath(path.steps)} className="primary-button">
              Play ii–V–I
            </button>
          </div>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {path.steps.map((step, i) => (
              <li key={step.spec.label} className="voicing-card path-step">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-emerald-700">{step.spec.label}</span>
                  {i > 0 && <span className="text-xs text-gray-500">moves {step.movement}</span>}
                </div>
                <Link
                  href={`/voicings/${step.chosen.voicing.id}?root=${step.spec.rootPc}`}
                  className="text-2xl font-semibold hover:underline"
                >
                  {step.chosen.symbol}
                </Link>
                <StaffPreview
                  notes={step.chosen.midi}
                  chord={chordOf(step.chosen, step.spec.rootPc)}
                  className="min-h-[200px]"
                />
                <MiniKeyboard
                  notes={step.chosen.midi}
                  chord={chordOf(step.chosen, step.spec.rootPc)}
                />
                <p className="font-mono text-xs text-gray-500">
                  {spellNames(step.chosen, step.spec.rootPc)}
                </p>
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => void piano.play(step.chosen.midi, false)}
                    className="secondary-button !px-3 !text-xs"
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    aria-expanded={openStep === i}
                    disabled={step.alternatives.length === 0}
                    onClick={() => setOpenStep(openStep === i ? null : i)}
                    className="secondary-button !px-3 !text-xs disabled:opacity-40"
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
                  <ul className="path-alternatives flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {step.alternatives.map((option) => (
                      <li key={option.key}>
                        <button
                          type="button"
                          onClick={() => pin(i, option.key)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="w-20 shrink-0 text-sm font-semibold">
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
