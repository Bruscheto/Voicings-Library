/**
 * Note spelling by function. Each note takes the letter its degree implies
 * (the 3rd of F# is A, the 5th is C#, so F#m9 is F# A C# E G#), and the root
 * is named whichever way, sharp or flat, spells the chord more simply (C#m7,
 * not Dbm7 with its Fb; Gbmaj7, not F#maj7 with its E#).
 *
 * Readability wins over strict theory: a degree that would land on E#, B#,
 * Cb, Fb or a double accidental falls back to the plain name in the root's
 * direction, so Db7 over B reads Db7/B rather than Db7/Cb.
 */

import { buildSymbol } from './canonicalize';
import { mod12, pcName, type PitchClass } from './pitch';
import { isBaseQuality, QUALITIES, type BaseQuality } from './qualities';

export type SpellingChord = {
  rootPc: PitchClass;
  quality: BaseQuality;
  tensions?: readonly string[];
};

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const EXOTIC = new Set(['E#', 'B#', 'Cb', 'Fb']);
const OCTAVE = 12;

// Letters above the root for every degree label the engine produces.
const DEGREE_STEPS: Record<string, number> = {
  R: 0,
  b9: 1,
  '9': 1,
  '#9': 1,
  '2': 1,
  b3: 2,
  '3': 2,
  '4': 3,
  '11': 3,
  '#11': 3,
  b5: 4,
  '5': 4,
  '#5': 4,
  '6': 5,
  b13: 5,
  '13': 5,
  bb7: 6,
  b7: 6,
  '7': 6,
};

type Spelled = { letter: number; accidental: number };

const accidentalText = (n: number) => (n > 0 ? '#'.repeat(n) : 'b'.repeat(-n));
const nameOf = ({ letter, accidental }: Spelled) =>
  `${LETTERS[letter]}${accidentalText(accidental)}`;

function parseName(name: string): Spelled {
  const letter = LETTERS.indexOf(name[0] as (typeof LETTERS)[number]);
  const accidental = [...name.slice(1)].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0);
  return { letter, accidental };
}

/** Interval → degree label for a quality, chord tones first, then its tensions. */
function labelFor(quality: BaseQuality, interval: number): string | undefined {
  const def = QUALITIES[quality];
  return def.tones[interval]?.label ?? def.tensions[interval];
}

function spellFrom(
  root: Spelled,
  pc: PitchClass,
  label: string | undefined,
  sharpLeaning: boolean,
): Spelled {
  const plain = parseName((sharpLeaning ? SHARP_NAMES : FLAT_NAMES)[mod12(pc)]);
  const steps = label === undefined ? undefined : DEGREE_STEPS[label];
  if (steps === undefined) return plain;
  const letter = (root.letter + steps) % LETTERS.length;
  let accidental = mod12(pc - LETTER_PC[letter]);
  if (accidental > OCTAVE / 2) accidental -= OCTAVE;
  const spelled = { letter, accidental };
  return Math.abs(accidental) > 1 || EXOTIC.has(nameOf(spelled)) ? plain : spelled;
}

function chordIntervals(chord: SpellingChord): number[] {
  const def = QUALITIES[chord.quality];
  const tensionIntervals = Object.entries(def.tensions)
    .filter(([, name]) => chord.tensions?.includes(name))
    .map(([interval]) => Number(interval));
  return [...Object.keys(def.tones).map(Number), ...tensionIntervals];
}

/** Accidentals a reader must process; awkward spellings count extra. */
function difficulty(root: Spelled, chord: SpellingChord): number {
  const sharpLeaning = root.accidental > 0;
  return chordIntervals(chord).reduce((sum, interval) => {
    const label = labelFor(chord.quality, interval);
    const steps = label === undefined ? undefined : DEGREE_STEPS[label];
    if (steps === undefined) return sum;
    const letter = (root.letter + steps) % LETTERS.length;
    let accidental = mod12(chord.rootPc + interval - LETTER_PC[letter]);
    if (accidental > OCTAVE / 2) accidental -= OCTAVE;
    const awkward = Math.abs(accidental) > 1 || EXOTIC.has(nameOf({ letter, accidental }));
    return (
      sum + Math.abs(accidental) + (awkward ? 1 : 0) + (sharpLeaning && accidental < 0 ? 0.5 : 0)
    );
  }, 0);
}

/** The root's name: the enharmonic that spells this chord more simply; flats win ties. */
export function rootName(chord: SpellingChord): string {
  const flat = parseName(FLAT_NAMES[mod12(chord.rootPc)]);
  const sharp = parseName(SHARP_NAMES[mod12(chord.rootPc)]);
  if (flat.accidental === 0) return nameOf(flat);
  return difficulty(sharp, chord) < difficulty(flat, chord) ? nameOf(sharp) : nameOf(flat);
}

function spelledPc(pc: PitchClass, chord: SpellingChord): Spelled {
  const root = parseName(rootName(chord));
  return spellFrom(
    root,
    pc,
    labelFor(chord.quality, mod12(pc - chord.rootPc)),
    root.accidental > 0,
  );
}

/** A pitch class named as a member of the chord, e.g. the bass of a slash chord. */
export function spellPc(pc: PitchClass, chord: SpellingChord): string {
  return nameOf(spelledPc(pc, chord));
}

/** A MIDI note named as a member of the chord, with its octave: 61 in A major → "C#4". */
export function spellMidi(midi: number, chord: SpellingChord): string {
  const spelled = spelledPc(mod12(midi), chord);
  const natural = midi - spelled.accidental;
  return `${nameOf(spelled)}${Math.floor(natural / OCTAVE) - 1}`;
}

export function spellVoicing(midi: readonly number[], chord: SpellingChord): string[] {
  return midi.map((note) => spellMidi(note, chord));
}

/**
 * Display symbol with the root and slash bass spelled for the chord
 * (C#min7/E, Gbmaj7/Bb). Unknown qualities keep plain names.
 */
export function chordSymbol(
  rootPc: PitchClass,
  quality: string,
  tensions: readonly string[],
  bassPc: PitchClass | null,
): string {
  const slashPc = bassPc === null || mod12(bassPc) === mod12(rootPc) ? null : bassPc;
  if (!isBaseQuality(quality)) {
    return buildSymbol(
      pcName(rootPc),
      quality,
      [...tensions],
      slashPc === null ? null : pcName(slashPc),
    );
  }
  const chord = { rootPc, quality, tensions };
  return buildSymbol(
    rootName(chord),
    quality,
    [...tensions],
    slashPc === null ? null : spellPc(slashPc, chord),
  );
}
