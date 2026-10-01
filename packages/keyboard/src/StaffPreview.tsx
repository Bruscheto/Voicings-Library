'use client';

import { useEffect, useId, useRef } from 'react';
import { StaffRenderer } from 'music-engine';
import { toVexFlow } from './usePiano';

type Props = { notes: number[]; className?: string };

/** Grand staff for a set of MIDI notes. Several can share a page. */
export function StaffPreview({ notes, className = 'min-h-[230px]' }: Props) {
  const id = `staff-${useId().replace(/:/g, '')}`;
  const renderer = useRef<StaffRenderer | null>(null);

  useEffect(() => {
    renderer.current ??= new StaffRenderer(id);
    renderer.current.render(notes.map(toVexFlow));
  }, [id, notes]);

  return (
    <div
      className={`custom-scrollbar flex items-center justify-center overflow-auto rounded-md border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-2 ${className}`}
    >
      <div id={id} className="mx-auto flex w-full max-w-xs items-center justify-center" />
    </div>
  );
}
