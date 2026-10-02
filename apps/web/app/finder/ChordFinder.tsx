'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  classifyStructure,
  detectChord,
  formatProbability,
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
import { VoicingCard } from './VoicingCard';
import { STRUCTURE_LABEL, visibleStructures } from '../../lib/structure';
import { StructureChips } from '../../components/StructureChips';

const STARTERS = ['Dm9', 'G13', 'Cmaj7'];
const EXAMPLES = ['Dm9', 'G13', 'Cmaj7', 'G7alt', 'Bø', 'Cm6', 'F6/9', 'Ebmaj7#11'];
const EMPTY_DEGREES = new Map();

function groupOf(result: FinderResult): string {
  return visibleStructures(result.structure)[0] ?? 'other';
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
  const urlQuery = params.get('q') ?? '';
  useEffect(() => {
    if (mode !== 'type') return;
    const query = text.trim();
    // Already there: a needless replace would cancel a result link clicked meanwhile.
    if (query === urlQuery) return;
    const timer = setTimeout(
      () => router.replace(query ? `/?q=${encodeURIComponent(query)}` : '/', { scroll: false }),
      300,
    );
    return () => clearTimeout(timer);
  }, [text, mode, router, urlQuery]);

  useEffect(() => setHeardIndex(0), [input.notes]);

  const heard = useMemo(() => detectChord(input.notes).readings, [input.notes]);
  const typed = useMemo(() => parse(text), [text]);
  // What the played notes are as a voicing, under the reading picked above.
  const playedStructure = useMemo(() => {
    const reading = heard[heardIndex];
    if (!reading) return [];
    return visibleStructures(
      classifyStructure(input.notes, { rootPc: reading.rootPc, quality: reading.quality }),
    );
  }, [input.notes, heard, heardIndex]);
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
  const starters = useMemo(
    () =>
      STARTERS.flatMap((symbol) => {
        const query = queryFromSymbol(symbol);
        const result = findVoicings(library, query)[0];
        return result ? [{ ...result, rootPc: query.rootPc }] : [];
      }),
    [library],
  );
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
    <div className="flex flex-col gap-10">
      <section className="panel finder-panel" aria-label="Find a voicing">
        <div className="finder-panel-top">
          <div className="segmented-control" aria-label="Chord input mode" role="tablist">
            {(['type', 'play'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                id={`input-tab-${m}`}
                aria-controls="chord-input-panel"
                tabIndex={mode === m ? 0 : -1}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 'type'
                      : event.key === 'End'
                        ? 'play'
                        : mode === 'type'
                          ? 'play'
                          : 'type';
                  setMode(next);
                  document.getElementById(`input-tab-${next}`)?.focus();
                }}
                onClick={() => setMode(m)}
              >
                {m === 'type' ? 'Type a chord' : 'Play a chord'}
              </button>
            ))}
          </div>

          <span className="finder-panel-note">Any chord. All 12 keys.</span>
        </div>
        <div id="chord-input-panel" role="tabpanel" aria-labelledby={`input-tab-${mode}`}>
          {mode === 'type' ? (
            <div>
              <label htmlFor="chord-symbol" className="field-label">
                Chord symbol
              </label>
              <input
                id="chord-symbol"
                aria-invalid={Boolean(typed.error)}
                aria-describedby={typed.error ? 'chord-error' : 'chord-help'}
                autoComplete="off"
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Try Dm9"
                aria-label="Chord symbol"
                className="finder-input"
              />
              {typed.error ? (
                <p id="chord-error" role="alert" className="mt-3 text-sm text-red-700">
                  {typed.error}
                </p>
              ) : (
                <div id="chord-help" className="finder-examples">
                  <span>Try a chord</span>
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setText(example)}
                      className="chip"
                      aria-pressed={text === example}
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
                Play on a MIDI keyboard ({midiStatus === 'ready' ? 'connected' : 'not connected'})
                or click the keys below. Voicings are matched by chord, in any key and register.
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
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {reading.symbol}{' '}
                      <span className="font-normal tabular-nums opacity-70">
                        {formatProbability(reading.probability)}
                      </span>
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
              {playedStructure.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Played structure"
                >
                  <span className="text-sm text-gray-500">Structure</span>
                  <StructureChips structure={playedStructure} size="md" />
                </div>
              )}
              {exactShape && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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
        </div>
      </section>

      {query && (
        <section className="finder-results" aria-live="polite">
          <h2 className="result-summary text-base text-gray-600">
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
          <div className="flex flex-col gap-10">
            {groups.map(({ group, results: groupResults }) => (
              <div key={group}>
                <h3 className="result-group-heading">
                  {STRUCTURE_LABEL[group] ?? 'Other voicings'}
                  <span>{groupResults.length}</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupResults.map((r) => (
                    <VoicingCard
                      key={r.voicing.id}
                      id={r.voicing.id}
                      name={r.reading.isPrimary ? r.voicing.name : null}
                      symbol={r.symbol}
                      midi={r.midi}
                      rootPc={query.rootPc}
                      quality={r.reading.quality}
                      tensions={r.reading.tensions}
                      structure={r.structure}
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
      {!query &&
        (mode === 'play' || !typed.error) &&
        (mode === 'type' || input.notes.length === 0) && (
          <section aria-labelledby="starter-heading">
            <div className="result-summary">
              <h2 id="starter-heading" className="section-heading">
                A place to start
              </h2>
              <p className="text-sm text-gray-500">Listen to a voicing, then make it your own.</p>
            </div>
            {starters.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {starters.map((r) => (
                  <VoicingCard
                    key={r.voicing.id + r.symbol}
                    id={r.voicing.id}
                    name={r.reading.isPrimary ? r.voicing.name : null}
                    symbol={r.symbol}
                    midi={r.midi}
                    rootPc={r.rootPc}
                    quality={r.reading.quality}
                    tensions={r.reading.tensions}
                    structure={r.structure}
                    onPlay={(midi) => void piano.play(midi, false)}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-state text-gray-600">
                Your library is ready for its first voicing. Saved shapes will appear here.
              </p>
            )}
          </section>
        )}
      {mode === 'play' && input.notes.length > 0 && !query && (
        <p className="empty-state text-gray-600" role="status">
          Add a few more notes to identify a chord, or clear the keys and try again.
          <button type="button" className="secondary-button ml-3" onClick={input.clear}>
            Clear
          </button>
        </p>
      )}
      <div className="practice-link">
        <div>
          <h2 className="section-heading">Put the chords in motion.</h2>
          <p>Connect your voicings in a voice-led ii-V-I progression.</p>
        </div>
        <Link href="/paths" className="secondary-button">
          Explore ii-V-I{' '}
          <span aria-hidden="true" className="ml-3">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
