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
    <div className="panel mb-10 p-5 sm:p-6">
      <form onSubmit={submitSearch} className="filter-form">
        <div>
          <label htmlFor="library-search" className="field-label">
            Chord symbol
          </label>
          <input
            id="library-search"
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chord symbol…"
            className="filter-field"
          />
        </div>
        <button type="submit" className="primary-button">
          Search
        </button>
        <div>
          <label htmlFor="library-quality" className="field-label">
            Quality
          </label>
          <select
            id="library-quality"
            value={currentQuality}
            onChange={(e) => updateUrl({ quality: e.target.value || null })}
            className="filter-field"
          >
            <option value="">All qualities</option>
            {qualities.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        {anyActive && (
          <button
            type="button"
            onClick={() => router.push('/voicings')}
            className="secondary-button"
          >
            Reset
          </button>
        )}
      </form>

      {tags.length > 0 && (
        <div className="filter-section flex flex-wrap gap-2" role="group" aria-label="Tags">
          {tags.map((tag) => {
            const selected = currentTagNames.includes(tag.name);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.name)}
                aria-pressed={selected}
                className="chip"
              >
                {tag.name.replace(/^collection:/, '')}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="filter-section flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Tensions"
      >
        <span className="mr-2 text-sm font-medium text-gray-700">Tensions</span>
        <button
          type="button"
          onClick={toggleNoTensions}
          aria-pressed={noTensionMode}
          className="chip"
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
              aria-pressed={selected}
              className="chip font-mono"
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
