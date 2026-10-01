import { useCallback, useEffect, useRef, useState } from 'react';
import { midiToPitch } from 'harmony';
import { Sampler } from 'sampler';

const sampler = new Sampler();
const ARPEGGIO_STEP_MS = 100;

/** "Bb3" → "bb/3", the note key the sampler and VexFlow use. */
export const toVexFlow = (midi: number) => {
  const pitch = midiToPitch(midi);
  return `${pitch.slice(0, -1).toLowerCase()}/${pitch.slice(-1)}`;
};

export type PianoStatus = 'loading' | 'ready' | 'partial' | 'synth' | 'unavailable';

/**
 * Sample loading and playback. Status reflects what actually loaded; audio
 * starts only after the sampler has activated from a user gesture.
 */
export function usePiano() {
  const [status, setStatus] = useState<PianoStatus>('loading');
  const mounted = useRef(false);
  const failed = useRef(false);
  const generation = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const markUnavailable = useCallback(() => {
    failed.current = true;
    if (mounted.current) setStatus('unavailable');
  }, []);

  useEffect(() => {
    mounted.current = true;
    sampler.init();
    sampler
      .loadPianoSamples()
      .then(({ loaded, failed: missing }) => {
        if (!mounted.current || failed.current) return;
        setStatus(loaded === 0 ? 'synth' : missing > 0 ? 'partial' : 'ready');
      })
      .catch(markUnavailable);
    return () => {
      mounted.current = false;
      generation.current += 1;
      clearTimers();
    };
  }, [clearTimers, markUnavailable]);

  const sound = useCallback(
    (midi: number) => {
      sampler.init();
      void sampler.play(toVexFlow(midi)).catch(markUnavailable);
    },
    [markUnavailable],
  );

  const play = useCallback(
    async (midi: readonly number[], arpeggio: boolean) => {
      const run = ++generation.current;
      clearTimers();
      const stale = () => !mounted.current || run !== generation.current;
      try {
        await sampler.activate();
        if (stale()) return;
        const notes = midi.map(toVexFlow);
        if (!arpeggio) {
          await Promise.all(notes.map((note) => sampler.play(note)));
          return;
        }
        notes.forEach((note, index) => {
          const timer = setTimeout(() => {
            if (!stale()) void sampler.play(note).catch(markUnavailable);
          }, index * ARPEGGIO_STEP_MS);
          timers.current.push(timer);
        });
      } catch {
        if (!stale()) markUnavailable();
      }
    },
    [clearTimers, markUnavailable],
  );

  /** Chords one after another, `stepMs` apart; a new play or stop cancels it. */
  const playSequence = useCallback(
    async (chords: readonly (readonly number[])[], stepMs: number) => {
      const run = ++generation.current;
      clearTimers();
      const stale = () => !mounted.current || run !== generation.current;
      try {
        await sampler.activate();
        if (stale()) return;
        chords.forEach((chord, index) => {
          const timer = setTimeout(() => {
            if (stale()) return;
            chord.forEach((midi) => void sampler.play(toVexFlow(midi)).catch(markUnavailable));
          }, index * stepMs);
          timers.current.push(timer);
        });
      } catch {
        if (!stale()) markUnavailable();
      }
    },
    [clearTimers, markUnavailable],
  );

  const stop = useCallback(() => {
    generation.current += 1;
    clearTimers();
  }, [clearTimers]);

  return { status, sound, play, playSequence, stop };
}
