import { pitchToMidi } from './pitch';

/** Test helper: "C3 E3 G3" → MIDI numbers. */
export const notes = (pitches: string): number[] => pitches.split(/\s+/).map(pitchToMidi);
