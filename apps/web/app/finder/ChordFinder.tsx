'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  detectChord,
  findShape,
  findVoicings,
  mod12,
  queryFromSymbol,
  querySymbol,
  type ChordQuery,
  type FinderResult,
  type LibraryVoicing,
} from 'harmony';
import { PianoKeyboard, useCapturedNotes, usePiano, useWebMidi } from 'keyboard';
import { STRUCTURE_LABEL, VoicingCard } from './VoicingCard';

const EXAMPLES = ['Dm9', 'G13', 'Cmaj7', 'G7alt', 'Bø', 'Cm6', 'F6/9', 'Ebmaj7#11'];
const STRUCTURE_PRIORITY = [
  'rootless-a',
  'rootless-b',
  'shell',
  'drop2',
  'drop3',
  'quartal',
  'ust',
];
const EMPTY_DEGREES = new Map();

function groupOf(result: FinderResult): string {
  return STRUCTURE_PRIORITY.find((tag) => result.voicing.structure.includes(tag)) ?? 'other';
}

/** Root of a stored shape's primary reading when played on these notes. */
function playedRoot(voicing: LibraryVoicing, notes: number[]): number {
  const primary = voicing.readings.find((r) => r.isPrimary) ?? voicing.readings[0];
  return mod12(notes[0] + (primary?.rootOffset ?? 0));
}

function parse(text: string): { query: ChordQuery | null; error: string | null } {
  if (!text.trim()) return { query: null, error: null };
  try {
    return { query: queryFromSymbol(text), error: null };
  } catch {
    return { query: null, error: `"${text}" is not a chord symbol this library can read.` };
  }
}

type Mode = 'type' | 'play';

export function ChordFinder({ library }: { library: LibraryVoicing[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<Mode>('type');
  const [heardIndex, setHeardIndex] = useState(0);
  const piano = usePiano();
  const input = useCapturedNotes(piano.sound);
  const midiStatus = useWebMidi({
    onNoteOn: (midi) => {
      setMode('play');
      input.press(midi);
    },
    onNoteOff: input.release,
  });

  // Keep the typed chord in the URL so a search can be shared or revisited.
  useEffect(() => {
    if (mode !== 'type') return;
    const timer = setTimeout(
      () =>
        router.replace(text.trim() ? `/?q=${encodeURIComponent(text.trim())}` : '/', {
          scroll: false,
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [text, mode, router]);

  useEffect(() => setHeardIndex(0), [input.notes]);

  const heard = useMemo(() => detectChord(input.notes).readings, [input.notes]);
  const typed = useMemo(() => parse(text), [text]);
  const query = useMemo((): ChordQuery | null => {
    if (mode === 'type') return typed.query;
    const reading = heard[heardIndex];
    // Played notes are matched by chord, not by which note is in the bass.
    return reading
      ? {
          rootPc: reading.rootPc,
          quality: reading.quality,
          tensions: reading.tensions,
          bassPc: null,
          altered: false,
        }
      : null;
  }, [mode, typed, heard, heardIndex]);

  const results = useMemo(() => (query ? findVoicings(library, query) : []), [library, query]);
  const exactShape = mode === 'play' ? findShape(library, input.notes) : null;
  // Groups appear in the order of their best result, so exact matches lead.
  const groups = useMemo(() => {
    const map = new Map<string, FinderResult[]>();
    for (const result of results)
      map.set(groupOf(result), [...(map.get(groupOf(result)) ?? []), result]);
    return Array.from(map, ([group, groupResults]) => ({ group, results: groupResults }));
  }, [results]);
  const looser =
    query && results.length === 0 && query.tensions.length > 0
      ? querySymbol({ ...query, tensions: [] })
      : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div
          className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium sm:w-fit"
          role="tablist"
        >
          {(['type', 'play'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-4 py-1.5 transition ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {m === 'type' ? 'Type a chord' : 'Play a chord'}
            </button>
          ))}
        </div>

        {mode === 'type' ? (
          <div>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Dm9, G7alt, Cmaj7#11, F6/9/A…"
              aria-label="Chord symbol"
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-2xl font-semibold tracking-tight outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
            {typed.error ? (
              <p className="mt-2 text-sm text-red-700">{typed.error}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setText(example)}
                    className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:border-gray-400"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Play on a MIDI keyboard ({midiStatus === 'ready' ? 'connected' : 'not connected'}) or
              click the keys below. Voicings are matched by chord, in any key and register.
            </p>
            {heard.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm text-gray-500">Heard as</span>
                {heard.slice(0, 4).map((reading, i) => (
                  <button
                    key={reading.symbol}
                    type="button"
                    aria-pressed={i === heardIndex}
                    onClick={() => setHeardIndex(i)}
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                      i === heardIndex
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {reading.symbol}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={input.clear}
                  className="ml-auto text-sm text-gray-500 hover:text-gray-900"
                >
                  Clear
                </button>
              </div>
            )}
            {exactShape && (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                This exact voicing is in the library:{' '}
                <Link
                  href={`/voicings/${exactShape.id}?root=${playedRoot(exactShape, input.notes)}`}
                  className="font-semibold underline"
                >
                  {exactShape.name ?? 'open it'}
                </Link>
              </p>
            )}
            <PianoKeyboard notes={input.notes} degrees={EMPTY_DEGREES} onToggle={input.toggle} />
          </div>
        )}
      </section>

      {query && (
        <section aria-live="polite">
          <h2 className="mb-4 text-sm text-gray-500">
            {results.length === 0 ? (
              <>
                No voicings for <strong className="text-gray-900">{querySymbol(query)}</strong> yet.
              </>
            ) : (
              <>
                {results.length} voicing{results.length === 1 ? '' : 's'} for{' '}
                <strong className="text-gray-900">{querySymbol(query)}</strong>, shown in this key
              </>
            )}
            {looser && (
              <>
                {' '}
                Try{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('type');
                    setText(looser);
                  }}
                  className="font-semibold text-gray-900 underline"
                >
                  {looser}
                </button>
                .
              </>
            )}
          </h2>
          <div className="flex flex-col gap-8">
            {groups.map(({ group, results: groupResults }) => (
              <div key={group}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  {STRUCTURE_LABEL[group] ?? 'Other voicings'}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupResults.map((r) => (
                    <VoicingCard
                      key={r.voicing.id}
                      id={r.voicing.id}
                      name={r.voicing.name}
                      symbol={r.symbol}
                      midi={r.midi}
                      rootPc={query.rootPc}
                      quality={r.reading.quality}
                      tensions={r.reading.tensions}
                      structure={r.voicing.structure}
                      badge={r.match === 'extended' ? 'adds tensions' : undefined}
                      onPlay={(midi) => void piano.play(midi, false)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
