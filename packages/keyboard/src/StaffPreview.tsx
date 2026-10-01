'use client';

import { useEffect, useId, useRef } from 'react';
import { StaffRenderer } from 'music-engine';
import { midiToPitch, spellVoicing, type SpellingChord } from 'harmony';
import { vexKey } from './usePiano';

type Props = {
  notes: number[];
  /** Spell notes as members of this chord (F#m9: C#, not Db). */
  chord?: SpellingChord | null;
  className?: string;
};

/** Grand staff for a set of MIDI notes. Several can share a page. */
export function StaffPreview({ notes, chord, className = 'min-h-[230px]' }: Props) {
  const id = `staff-${useId().replace(/:/g, '')}`;
  const renderer = useRef<StaffRenderer | null>(null);

  // Spelled names as a string, so a chord object rebuilt each render does not redraw.
  const pitches = (chord ? spellVoicing(notes, chord) : notes.map(midiToPitch)).join(' ');
  useEffect(() => {
    renderer.current ??= new StaffRenderer(id);
    renderer.current.render(pitches ? pitches.split(' ').map(vexKey) : []);
  }, [id, pitches]);

  return (
    <div
      className={`custom-scrollbar flex items-center justify-center overflow-auto rounded-md border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-2 ${className}`}
    >
      <div id={id} className="mx-auto flex w-full max-w-xs items-center justify-center" />
    </div>
  );
}
