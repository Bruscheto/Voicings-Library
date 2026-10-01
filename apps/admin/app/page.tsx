'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  classifyStructure,
  degreesOf,
  midiToPitch,
  realizeVoicing,
  spellVoicing,
  toShape,
} from 'harmony';
import { ReadingsPanel } from './capture/ReadingsPanel';
import { SavePanel } from './capture/SavePanel';
import { SessionLog, type SessionEntry } from './capture/SessionLog';
import { useLibrary } from './capture/useLibrary';
import {
  PianoKeyboard,
  StaffPreview,
  useCapturedNotes,
  usePiano,
  useWebMidi,
  type MidiStatus,
  type PianoStatus,
} from 'keyboard';
import { readingKey, useReadings } from './capture/useReadings';
import { useSaveVoicing } from './capture/useSaveVoicing';

const PIANO_LABEL: Record<PianoStatus, string> = {
  loading: 'Loading piano…',
  ready: 'Piano ready',
  partial: 'Piano partial',
  synth: 'Synth fallback',
  unavailable: 'Audio unavailable',
};
const MIDI_LABEL: Record<MidiStatus, string> = {
  connecting: 'Connecting MIDI…',
  ready: 'MIDI ready',
  'no-devices': 'No MIDI device',
  unsupported: 'No Web MIDI',
  denied: 'MIDI blocked',
};
const OCTAVE = 12;
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const SHIFTS = [
  { label: 'Octave −', delta: -OCTAVE },
  { label: 'Semitone −', delta: -1 },
  { label: 'Semitone +', delta: 1 },
  { label: 'Octave +', delta: OCTAVE },
];

type Status = { tone: 'ok' | 'warn' | 'error'; text: string } | null;

export default function CapturePage() {
  const piano = usePiano();
  const captured = useCapturedNotes(piano.sound);
  const midiStatus = useWebMidi({ onNoteOn: captured.press, onNoteOff: captured.release });
  const { notes } = captured;
  const readings = useReadings(notes);
  const { library, error: libraryError, refresh } = useLibrary();
  const { save, isSaving } = useSaveVoicing();

  const [arpeggio, setArpeggio] = useState(false);
  const [name, setName] = useState('');
  const [addedCollections, setAddedCollections] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [clearAfterSave, setClearAfterSave] = useState(true);
  const [status, setStatus] = useState<Status>(null);
  const [session, setSession] = useState<SessionEntry[]>([]);

  const { primary } = readings;
  const degrees = useMemo(
    () => new Map(primary ? degreesOf(notes, primary).map((d) => [d.midi, d]) : []),
    [notes, primary],
  );
  // Names for reading: spelled as members of the primary reading. The server
  // still receives plain pitches; spelling is display only.
  const spelled = useMemo(
    () => (primary ? spellVoicing(notes, primary) : notes.map(midiToPitch)),
    [notes, primary],
  );
  const structure = useMemo(
    () => (primary ? classifyStructure(notes, primary) : []),
    [notes, primary],
  );

  // The same shape in any key is the same voicing.
  const existing = useMemo(() => {
    if (notes.length < 2) return null;
    const shape = library.shapes[toShape(notes).shapeKey];
    return shape
      ? { name: shape.name, symbol: realizeVoicing(shape, notes[0]).primary?.symbol ?? '—' }
      : null;
  }, [library, notes]);

  const collections = useMemo(
    () => Array.from(new Set([...library.collections, ...addedCollections])),
    [library.collections, addedCollections],
  );

  // A new chord dismisses the last save message; clearing after a save keeps it.
  useEffect(() => {
    if (notes.length) setStatus(null);
  }, [notes]);

  const handleSave = useCallback(async () => {
    if (notes.length < 2 || isSaving) return;
    const pitches = notes.map(midiToPitch);
    const outcome = await save({
      pitches,
      symbols: readings.chosen.map((r) => r.symbol),
      voicingName: name.trim() || null,
      collections: selectedCollections,
    });
    if (outcome.kind === 'error') return setStatus({ tone: 'error', text: outcome.message });
    if (outcome.kind === 'unchanged') {
      return setStatus({
        tone: 'warn',
        text: 'Already saved with these readings and collections.',
      });
    }
    const symbol = (readings.chosen[0] ?? primary)?.symbol ?? '—';
    setSession((prev) => [
      { id: outcome.id, symbol, pitches: spelled, outcome: outcome.kind },
      ...prev,
    ]);
    void refresh();
    if (clearAfterSave) {
      captured.clear();
      setName('');
    }
    setStatus({
      tone: 'ok',
      text:
        outcome.kind === 'created'
          ? `Saved ${symbol}.`
          : `Added ${outcome.readings} reading(s) and ${outcome.tags} collection(s) to the existing voicing.`,
    });
  }, [
    notes,
    spelled,
    isSaving,
    save,
    readings.chosen,
    primary,
    name,
    selectedCollections,
    refresh,
    clearAfterSave,
    captured,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < readings.candidates.length) {
        e.preventDefault();
        readings.toggle(readingKey(readings.candidates[index]));
      } else if (e.key === 'Enter' && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        void handleSave();
      } else if (e.code === 'Space' && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        void piano.play(notes, arpeggio);
      } else if (e.key === 'x' || e.key === 'X') {
        captured.shift(OCTAVE);
      } else if (e.key === 'z' || e.key === 'Z') {
        captured.shift(-OCTAVE);
      } else if (e.key === 'Escape') {
        captured.clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readings, handleSave, piano, notes, arpeggio, captured]);

  const pill = (ok: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold ${
      ok
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-gray-200 bg-white text-gray-600'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              Capture
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Play a voicing</h1>
            <p className="mt-2 text-sm text-gray-600">
              <kbd className="font-mono">1–6</kbd> pick readings ·{' '}
              <kbd className="font-mono">Enter</kbd> save · <kbd className="font-mono">Space</kbd>{' '}
              play · <kbd className="font-mono">Z</kbd>/<kbd className="font-mono">X</kbd> octave ·{' '}
              <kbd className="font-mono">Esc</kbd> clear
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={pill(piano.status === 'ready')}>{PIANO_LABEL[piano.status]}</span>
            <span className={pill(midiStatus === 'ready')}>{MIDI_LABEL[midiStatus]}</span>
          </div>
        </header>

        {libraryError && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {libraryError}. Duplicate warnings and existing collections are unavailable.
          </p>
        )}

        <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-12">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-gray-600">{spelled.join(' ') || '—'}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void piano.play(notes, arpeggio)}
                  disabled={notes.length === 0}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-gray-300"
                >
                  Play
                </button>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={arpeggio}
                    onChange={(e) => setArpeggio(e.target.checked)}
                  />
                  Arpeggio
                </label>
              </div>
            </div>
            <StaffPreview notes={notes} chord={primary} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-5">
            <ReadingsPanel
              hasNotes={notes.length >= 2}
              candidates={readings.candidates}
              selected={readings.selected}
              ambiguous={readings.ambiguous}
              structure={structure}
              onToggle={readings.toggle}
              onAddSymbol={readings.addSymbol}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2 xl:col-span-3">
            {existing && (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Already in the library as <strong>{existing.name ?? existing.symbol}</strong>
                {existing.name ? ` (${existing.symbol})` : ''}, possibly in another key. Saving adds
                new readings and collections.
              </p>
            )}
            <SavePanel
              name={name}
              onNameChange={setName}
              collections={collections}
              selectedCollections={selectedCollections}
              onToggleCollection={(c) =>
                setSelectedCollections((prev) =>
                  prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                )
              }
              onAddCollection={(c) => {
                setAddedCollections((prev) => (prev.includes(c) ? prev : [...prev, c]));
                setSelectedCollections((prev) => (prev.includes(c) ? prev : [...prev, c]));
              }}
              clearAfterSave={clearAfterSave}
              onClearAfterSaveChange={setClearAfterSave}
              canSave={notes.length >= 2}
              isSaving={isSaving}
              status={status}
              onSave={() => void handleSave()}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Keyboard · <span className="text-amber-600">guide tones</span> highlighted
            </h2>
            <div className="flex gap-1.5">
              {SHIFTS.map(({ label, delta }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => captured.shift(delta)}
                  disabled={notes.length === 0}
                  className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={captured.clear}
                className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
          <PianoKeyboard
            notes={notes}
            degrees={degrees}
            onToggle={captured.toggle}
            chord={primary}
          />
        </section>

        <SessionLog entries={session} />
      </main>
    </div>
  );
}
