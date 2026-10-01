/**
 * Pure grand-staff planning: which staff and voice each note goes to, which
 * accidentals to print, and how much vertical room the staves need so ledger
 * notes and accidentals never collide. Distances are in VexFlow pixels
 * (10px between staff lines, 5px per diatonic step).
 */

export type Clef = 'treble' | 'bass';

export type StaffNote = {
  /** VexFlow key, e.g. "f#/4". */
  key: string;
  /** Diatonic position: octave * 7 + letter index (C4 = 28). */
  step: number;
  /** Semitone offset of the accidental (-2..2). */
  alter: number;
  /** Accidental glyph to print, if any ("#", "b", "##", "bb", "n"). */
  accidental: string | null;
};

export type StaffPlan = {
  clef: Clef;
  /**
   * Chords to stack in the same column. Notes on the same line (Db + D#)
   * cannot share a notehead column, so each extra one goes to its own voice.
   */
  voices: StaffNote[][];
};

export type GrandStaffPlan = {
  treble: StaffPlan;
  bass: StaffPlan;
  /** Space above the treble top line. */
  top: number;
  /** Space between the treble bottom line and the bass top line. */
  gap: number;
  /** Space below the bass bottom line. */
  bottom: number;
};

export const LINE_SPACING = 10;
export const STAFF_HEIGHT = 4 * LINE_SPACING;
const STEP_PX = LINE_SPACING / 2;
const NOTEHEAD_HALF = STEP_PX;

const MIDDLE_C = 28;
const TREBLE_TOP = 38; // F5
const TREBLE_BOTTOM = 30; // E4
const BASS_TOP = 26; // A3
const BASS_BOTTOM = 18; // G2

/** Clefs and brace already need this much room. */
const MIN_TOP = 24;
const MIN_BOTTOM = 16;
/** Conventional grand-staff distance when nothing sits between the staves. */
const MIN_GAP = 50;
/** Clearance between the nearest glyphs of two staves. */
const CLEARANCE = 6;

const LETTERS = 'cdefgab';
const ALTER: Record<string, number> = { '': 0, n: 0, '#': 1, '##': 2, b: -1, bb: -2 };

/** How far an accidental glyph reaches above / below its note's centre. */
const ACCIDENTAL_REACH: Record<string, { up: number; down: number }> = {
  '#': { up: 15, down: 15 },
  n: { up: 15, down: 15 },
  b: { up: 18, down: 5 },
  bb: { up: 18, down: 5 },
  '##': { up: 5, down: 5 },
};

export function parseKey(key: string): StaffNote | null {
  const match = /^([a-g])(##|#|bb|b|n)?\/(-?\d+)$/i.exec(key.trim());
  if (!match) return null;
  const [, letter, acc = '', octave] = match;
  const accidental = acc.toLowerCase();
  return {
    key: `${letter.toLowerCase()}${accidental}/${octave}`,
    step: Number(octave) * 7 + LETTERS.indexOf(letter.toLowerCase()),
    alter: ALTER[accidental],
    accidental: accidental && accidental !== 'n' ? accidental : null,
  };
}

const byPitch = (a: StaffNote, b: StaffNote) => a.step - b.step || a.alter - b.alter;

function planStaff(clef: Clef, notes: StaffNote[]): StaffPlan {
  const unique = notes.filter(
    (note, i) => notes.findIndex((other) => other.step === note.step && other.alter === note.alter) === i,
  );
  const sharesLine = (note: StaffNote) => unique.some((other) => other !== note && other.step === note.step);

  // A natural next to its altered neighbour (A with Ab) needs its sign.
  const marked = unique.map((note) =>
    note.accidental === null && sharesLine(note) ? { ...note, accidental: 'n' } : note,
  );

  // Highest spelling on a line stays in the main chord; lower ones move to
  // extra voices that the formatter shifts sideways.
  const voices: StaffNote[][] = [];
  const sorted = [...marked].sort((a, b) => byPitch(b, a));
  sorted.forEach((note) => {
    const level = sorted.filter((other) => other.step === note.step && other.alter > note.alter).length;
    voices[level] = [...(voices[level] ?? []), note];
  });

  return { clef, voices: voices.map((voice) => [...voice].sort(byPitch)) };
}

const reach = (note: StaffNote, direction: 'up' | 'down') =>
  Math.max(NOTEHEAD_HALF, note.accidental ? ACCIDENTAL_REACH[note.accidental][direction] : 0);

/** Pixels a note's glyphs stick out above a staff line (negative: inside). */
const above = (note: StaffNote, line: number) => (note.step - line) * STEP_PX + reach(note, 'up');
const below = (note: StaffNote, line: number) => (line - note.step) * STEP_PX + reach(note, 'down');

const maxOf = (values: number[]) => Math.max(0, ...values);

export function planGrandStaff(keys: string[]): GrandStaffPlan {
  const notes = keys.map(parseKey).filter((note): note is StaffNote => note !== null);
  const trebleNotes = notes.filter((note) => note.step >= MIDDLE_C);
  const bassNotes = notes.filter((note) => note.step < MIDDLE_C);

  const top = Math.max(MIN_TOP, maxOf(trebleNotes.map((n) => above(n, TREBLE_TOP))) + CLEARANCE);
  const gap = Math.max(
    MIN_GAP,
    maxOf(trebleNotes.map((n) => below(n, TREBLE_BOTTOM))) +
      maxOf(bassNotes.map((n) => above(n, BASS_TOP))) +
      CLEARANCE,
  );
  const bottom = Math.max(MIN_BOTTOM, maxOf(bassNotes.map((n) => below(n, BASS_BOTTOM))) + CLEARANCE);

  return {
    treble: planStaff('treble', trebleNotes),
    bass: planStaff('bass', bassNotes),
    top,
    gap,
    bottom,
  };
}
