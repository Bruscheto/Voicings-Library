import { useCallback, useEffect, useState } from 'react';
import { PianoEngine, browserDeps, type PianoStatus } from './pianoEngine';

export type { PianoStatus } from './pianoEngine';

// One engine per page load: every component shares the context and samples.
let engine: PianoEngine | null = null;
const getEngine = () => (engine ??= new PianoEngine(browserDeps));

const MS_PER_SECOND = 1000;

/**
 * The shared piano. Samples start loading on first mount; playback waits for
 * them, so the first sound is always the piano. Unmounting stops playback.
 */
export function usePiano() {
  const [status, setStatus] = useState<PianoStatus>('loading');

  useEffect(() => {
    const piano = getEngine();
    piano.load();
    const unsubscribe = piano.subscribe(setStatus);
    return () => {
      unsubscribe();
      piano.stop();
    };
  }, []);

  const sound = useCallback((midi: number) => void getEngine().playKey(midi), []);

  const play = useCallback(
    (midi: readonly number[], arpeggio: boolean) => getEngine().playChord(midi, arpeggio),
    [],
  );

  /** Chords one after another, `stepMs` apart; a new play or stop cancels it. */
  const playSequence = useCallback(
    (chords: readonly (readonly number[])[], stepMs: number) =>
      getEngine().playSequence(chords, stepMs / MS_PER_SECOND),
    [],
  );

  const stop = useCallback(() => getEngine().stop(), []);

  return { status, sound, play, playSequence, stop };
}
