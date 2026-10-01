'use client';

import { useState } from 'react';

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  collections: string[];
  selectedCollections: string[];
  onToggleCollection: (name: string) => void;
  onAddCollection: (name: string) => void;
  clearAfterSave: boolean;
  onClearAfterSaveChange: (value: boolean) => void;
  canSave: boolean;
  isSaving: boolean;
  status: { tone: 'ok' | 'warn' | 'error'; text: string } | null;
  onSave: () => void;
};

const STATUS_TONE = {
  ok: 'text-emerald-700',
  warn: 'text-amber-700',
  error: 'text-red-700',
};

export function SavePanel(props: Props) {
  const [newCollection, setNewCollection] = useState('');

  const addCollection = () => {
    const name = newCollection.trim();
    if (!name) return;
    props.onAddCollection(name);
    setNewCollection('');
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Name (optional)
        </span>
        <input
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          placeholder="e.g. Bill Evans rootless A"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
      </label>

      <div>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Collections
        </span>
        <div className="flex flex-wrap gap-1.5">
          {props.collections.map((collection) => {
            const selected = props.selectedCollections.includes(collection);
            return (
              <button
                key={collection}
                type="button"
                aria-pressed={selected}
                onClick={() => props.onToggleCollection(collection)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  selected
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'
                }`}
              >
                {collection}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={newCollection}
            onChange={(e) => setNewCollection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              addCollection();
            }}
            placeholder="New collection"
            aria-label="New collection name"
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-600"
          />
          <button
            type="button"
            onClick={addCollection}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Add
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={props.clearAfterSave}
          onChange={(e) => props.onClearAfterSaveChange(e.target.checked)}
          className="rounded text-purple-600 focus:ring-purple-600"
        />
        Clear after save, ready for the next voicing
      </label>

      <div className="mt-auto">
        {props.status && (
          <p className={`mb-2 text-sm ${STATUS_TONE[props.status.tone]}`}>{props.status.text}</p>
        )}
        <button
          type="button"
          onClick={props.onSave}
          disabled={!props.canSave || props.isSaving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {props.isSaving ? 'Saving…' : 'Save'}
          <kbd className="rounded border border-white/40 px-1.5 font-mono text-[11px]">Enter</kbd>
        </button>
      </div>
    </div>
  );
}
