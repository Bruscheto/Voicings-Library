import { useCallback, useEffect, useMemo, useState } from 'react';
import { analyzeVoicing, detectChord, parseSymbol, readAs, type Reading } from 'harmony';

const MAX_CANDIDATES = 6;

export const readingKey = (r: Pick<Reading, 'rootPc' | 'quality'>) => `${r.rootPc}:${r.quality}`;

/**
 * Engine readings of the captured notes plus any the author typed, and the
 * ones chosen to save. The first chosen reading is the primary one; with none
 * chosen the engine's top reading is used.
 */
export function useReadings(notes: number[]) {
  const detection = useMemo(() => detectChord(notes, MAX_CANDIDATES), [notes]);
  const [custom, setCustom] = useState<Reading[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setCustom([]);
    setSelected([]);
  }, [notes]);

  const candidates = useMemo(() => {
    const detected = new Set(detection.readings.map(readingKey));
    return [...detection.readings, ...custom.filter((r) => !detected.has(readingKey(r)))];
  }, [detection, custom]);

  const chosen = useMemo(
    () =>
      selected
        .map((key) => candidates.find((c) => readingKey(c) === key))
        .filter((r): r is Reading => !!r),
    [selected, candidates],
  );
  const primary = chosen[0] ?? candidates[0] ?? null;

  const toggle = useCallback((key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  /** Validate a typed symbol against the notes; returns an error message or null. */
  const addSymbol = useCallback(
    (symbol: string): string | null => {
      try {
        analyzeVoicing(notes, [symbol]);
        const parsed = parseSymbol(symbol);
        const reading = readAs(notes, parsed.rootPc, parsed.quality);
        if (!reading) return 'The notes do not spell this chord';
        setCustom((prev) => [...prev, reading]);
        setSelected((prev) =>
          prev.includes(readingKey(reading)) ? prev : [...prev, readingKey(reading)],
        );
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'Invalid symbol';
      }
    },
    [notes],
  );

  return {
    candidates,
    ambiguous: detection.ambiguous,
    selected,
    chosen,
    primary,
    toggle,
    addSymbol,
  };
}
