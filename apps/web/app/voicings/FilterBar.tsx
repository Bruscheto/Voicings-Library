'use client';

import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Tag = { id: string; name: string };

type Props = {
  qualities: string[];
  tags: Tag[];
};

const SEARCH_DEBOUNCE_MS = 300;
const TENSION_OPTIONS = ['b9', '9', '#9', '11', '#11', 'b13', '13'];

export default function FilterBar({ qualities, tags }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get('q') ?? '';
  const currentQuality = searchParams.get('quality') ?? '';
  const currentTagNames = searchParams.getAll('tag');
  const currentTensions = searchParams.getAll('tension');
  const currentTensionMode = searchParams.get('tensionMode') ?? '';
  const noTensionMode = currentTensionMode === 'none';

  const [search, setSearch] = useState(currentQ);
  const lastPushedRef = useRef(currentQ);

  // Debounce search input -> URL.
  useEffect(() => {
    if (search === lastPushedRef.current) return;
    const handle = setTimeout(() => {
      lastPushedRef.current = search;
      updateUrl({ q: search || null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Keep local search in sync if URL changes externally (e.g. reset button).
  useEffect(() => {
    if (currentQ !== lastPushedRef.current) {
      setSearch(currentQ);
      lastPushedRef.current = currentQ;
    }
  }, [currentQ]);

  function updateUrl(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      params.delete(key);
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `/voicings?${qs}` : '/voicings');
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lastPushedRef.current = search;
    updateUrl({ q: search || null });
  }

  function toggleTag(name: string) {
    const next = currentTagNames.includes(name)
      ? currentTagNames.filter((t) => t !== name)
      : [...currentTagNames, name];
    updateUrl({ tag: next.length ? next : null });
  }

  function toggleTension(name: string) {
    // Picking a specific tension cancels "no tensions" mode.
    const next = currentTensions.includes(name)
      ? currentTensions.filter((t) => t !== name)
      : [...currentTensions, name];
    updateUrl({ tension: next.length ? next : null, tensionMode: null });
  }

  function toggleNoTensions() {
    if (noTensionMode) {
      updateUrl({ tensionMode: null });
    } else {
      // Selecting "no tensions" clears any specific tension picks.
      updateUrl({ tensionMode: 'none', tension: null });
    }
  }

  const anyActive = Boolean(
    currentQ ||
      currentQuality ||
      currentTagNames.length > 0 ||
      currentTensions.length > 0 ||
      noTensionMode,
  );

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chord symbol…"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Search
        </button>
        <select
          value={currentQuality}
          onChange={(e) => updateUrl({ quality: e.target.value || null })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="">All qualities</option>
          {qualities.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        {anyActive && (
          <button
            type="button"
            onClick={() => router.push('/voicings')}
            className="rounded-md px-3 py-2 text-sm text-gray-500 transition hover:text-gray-900"
          >
            Reset
          </button>
        )}
      </form>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-100 pt-3">
          {tags.map((tag) => {
            const selected = currentTagNames.includes(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  selected
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tensions
        </span>
        <button
          type="button"
          onClick={toggleNoTensions}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            noTensionMode
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          No tensions
        </button>
        {TENSION_OPTIONS.map((t) => {
          const selected = currentTensions.includes(t);
          const disabled = noTensionMode;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTension(t)}
              disabled={disabled}
              className={`rounded-full px-3 py-1 font-mono text-xs font-medium transition ${
                disabled
                  ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                  : selected
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
