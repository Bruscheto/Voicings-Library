import { useCallback, useState } from 'react';

const SAVE_TIMEOUT_MS = 10_000;

export type SaveRequest = {
  pitches: string[];
  symbols: string[];
  voicingName: string | null;
  collections: string[];
};

export type SaveOutcome =
  | { kind: 'created'; id: string }
  | { kind: 'updated'; id: string; readings: number; tags: number }
  | { kind: 'unchanged' }
  | { kind: 'error'; message: string };

type SaveResponse = {
  success: boolean;
  error?: string;
  voicing?: { id: string };
  added?: { readings: number; tags: number };
};

export function useSaveVoicing() {
  const [isSaving, setIsSaving] = useState(false);

  const save = useCallback(async (request: SaveRequest): Promise<SaveOutcome> => {
    setIsSaving(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch('/api/voicings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(request),
      });
      const body = (await res.json().catch(() => ({ success: false }))) as SaveResponse;
      if (res.status === 409) return { kind: 'unchanged' };
      if (!res.ok || !body.voicing) {
        return { kind: 'error', message: body.error ?? `Save failed (${res.status})` };
      }
      return body.added
        ? { kind: 'updated', id: body.voicing.id, ...body.added }
        : { kind: 'created', id: body.voicing.id };
    } catch (error) {
      const aborted = (error as { name?: string })?.name === 'AbortError';
      return {
        kind: 'error',
        message: aborted ? 'Save timed out — retry' : 'Network error — retry',
      };
    } finally {
      clearTimeout(timeout);
      setIsSaving(false);
    }
  }, []);

  return { save, isSaving };
}
