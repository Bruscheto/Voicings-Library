'use client';

import { useState, type FormEvent } from 'react';
import type { Reading, Structure } from 'harmony';
import { ChordName } from './ChordName';
import { readingKey } from './useReadings';

type Props = {
  hasNotes: boolean;
  candidates: Reading[];
  selected: string[];
  ambiguous: boolean;
  structure: Structure[];
  onToggle: (key: string) => void;
  onAddSymbol: (symbol: string) => string | null;
};

const STRUCTURE_LABEL: Record<Structure, string> = {
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

export function ReadingsPanel({
  hasNotes,
  candidates,
  selected,
  ambiguous,
  structure,
  onToggle,
  onAddSymbol,
}: Props) {
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    const message = onAddSymbol(symbol.trim());
    setError(message);
    if (!message) setSymbol('');
  };

  if (!hasNotes) {
    return (
      <div className="flex h-full flex-col justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">Play a chord.</p>
        <p className="mt-1">It stays on screen after you let go; the next chord replaces it.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
          Readings
        </h2>
        {ambiguous && (
          <span className="text-xs text-amber-700">Ambiguous — keep every reading you mean</span>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The engine has no reading for these notes. Type the chord you mean below.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {candidates.map((reading, index) => {
            const key = readingKey(reading);
            const order = selected.indexOf(key);
            const isSelected = order !== -1;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onToggle(key)}
                  className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                    isSelected
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <kbd className="w-5 shrink-0 rounded border border-gray-300 bg-gray-50 text-center font-mono text-[11px] text-gray-500">
                    {index + 1}
                  </kbd>
                  <ChordName reading={reading} className="text-lg font-semibold text-gray-900" />
                  {reading.rootless && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      rootless
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                    {isSelected
                      ? order === 0
                        ? 'Primary'
                        : 'Also'
                      : index === 0 && selected.length === 0
                        ? 'Default'
                        : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={symbol}
          onChange={(e) => {
            setSymbol(e.target.value);
            setError(null);
          }}
          placeholder="Another reading, e.g. Dm9/F"
          aria-label="Add a reading by chord symbol"
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-red-700">{error}</p>}

      {structure.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
          {structure.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {STRUCTURE_LABEL[tag]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
