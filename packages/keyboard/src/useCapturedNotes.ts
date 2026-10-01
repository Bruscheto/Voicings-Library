import { useCallback, useRef, useState } from 'react';

export const MIN_MIDI = 21; // A0
export const MAX_MIDI = 108; // C8

const withNote = (notes: number[], midi: number) =>
  notes.includes(midi) ? notes : [...notes, midi].sort((a, b) => a - b);

/**
 * The chord being captured. A MIDI chord latches: it stays after the keys are
 * released, and the next note played with no keys held starts a new chord.
 * Virtual-keyboard clicks toggle single notes instead.
 */
export function useCapturedNotes(onSound: (midi: number) => void) {
  const [notes, setNotes] = useState<number[]>([]);
  const held = useRef(new Set<number>());
  const current = useRef(notes);
  current.current = notes;

  const press = useCallback(
    (midi: number) => {
      const startsNewChord = held.current.size === 0;
      held.current.add(midi);
      setNotes((prev) => (startsNewChord ? [midi] : withNote(prev, midi)));
      onSound(midi);
    },
    [onSound],
  );

  const release = useCallback((midi: number) => {
    held.current.delete(midi);
  }, []);

  const toggle = useCallback(
    (midi: number) => {
      const adding = !current.current.includes(midi);
      setNotes((prev) =>
        prev.includes(midi) ? prev.filter((n) => n !== midi) : withNote(prev, midi),
      );
      if (adding) onSound(midi);
    },
    [onSound],
  );

  const shift = useCallback((delta: number) => {
    setNotes((prev) =>
      prev.length && prev[0] + delta >= MIN_MIDI && prev[prev.length - 1] + delta <= MAX_MIDI
        ? prev.map((n) => n + delta)
        : prev,
    );
  }, []);

  const clear = useCallback(() => setNotes([]), []);

  return { notes, press, release, toggle, shift, clear };
}
