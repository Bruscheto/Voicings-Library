import { mod12, normalizeNotes, type PitchClass } from './pitch';
import { QUALITIES, type BaseQuality, type ChordRole } from './qualities';

export type DegreeRole = ChordRole | 'tension';

export type Degree = {
  midi: number;
  /** "R", "3", "b7", "9", "#11"… — what a player calls this note over the chord. */
  label: string;
  role: DegreeRole;
  /** The 3rd (4th on sus) or the 7th (6th on sixth chords): the chord's sound. */
  isGuideTone: boolean;
};

export type ChordRef = { rootPc: PitchClass; quality: BaseQuality };

/**
 * Label every note of a voicing against one reading. Notes the reading cannot
 * name are labelled "?" with role "tension" — callers that need a strict
 * check should use readAs() first.
 */
export function degreesOf(midi: readonly number[], chord: ChordRef): Degree[] {
  const def = QUALITIES[chord.quality];
  return normalizeNotes(midi).map((note) => {
    const interval = mod12(note - chord.rootPc);
    const tone = def.tones[interval];
    if (tone) {
      return {
        midi: note,
        label: tone.label,
        role: tone.role,
        isGuideTone: tone.role === 'third' || tone.role === 'seventh',
      };
    }
    return {
      midi: note,
      label: def.tensions[interval] ?? '?',
      role: 'tension',
      isGuideTone: false,
    };
  });
}

/** Pitch classes of the guide tones for a chord: [3rd-or-4th, 7th-or-6th?]. */
export function guideTones(chord: ChordRef): PitchClass[] {
  const def = QUALITIES[chord.quality];
  return Object.entries(def.tones)
    .filter(([, tone]) => tone.role === 'third' || tone.role === 'seventh')
    .map(([interval]) => mod12(chord.rootPc + Number(interval)));
}
