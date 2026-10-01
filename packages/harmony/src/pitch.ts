export type PitchClass = number;

// Jazz spelling: flats everywhere except F#, which charts favour over Gb.
const PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const NOTE_RE = /^([A-G])(#{1,2}|b{1,2})?$/;
const PITCH_RE = /^([A-G](?:#{1,2}|b{1,2})?)(-?\d)$/;

export function mod12(n: number): PitchClass {
  return ((n % 12) + 12) % 12;
}

export function pcName(pc: PitchClass): string {
  return PC_NAMES[mod12(pc)];
}

/** "C", "F#", "Bb", "Cbb" → pitch class. Throws on anything else. */
export function noteToPc(name: string): PitchClass {
  const m = NOTE_RE.exec(name.trim());
  if (!m) throw new Error(`not a note name: ${JSON.stringify(name)}`);
  const accidental = m[2] ?? '';
  const shift = accidental.startsWith('#') ? accidental.length : -accidental.length;
  return mod12(LETTER_PC[m[1]] + shift);
}

/** "C4" → 60, "Bb3" → 58. Throws on anything else. */
export function pitchToMidi(pitch: string): number {
  const m = PITCH_RE.exec(pitch.trim());
  if (!m) throw new Error(`not a pitch: ${JSON.stringify(pitch)}`);
  const name = m[1];
  const octave = Number(m[2]);
  const m2 = NOTE_RE.exec(name)!;
  const accidental = m2[2] ?? '';
  const shift = accidental.startsWith('#') ? accidental.length : -accidental.length;
  return (octave + 1) * 12 + LETTER_PC[m2[1]] + shift;
}

/** 60 → "C4", 61 → "Db4". */
export function midiToPitch(midi: number): string {
  return `${pcName(midi)}${Math.floor(midi / 12) - 1}`;
}

/** Sorted, de-duplicated MIDI notes. */
export function normalizeNotes(midi: readonly number[]): number[] {
  return Array.from(new Set(midi)).sort((a, b) => a - b);
}
