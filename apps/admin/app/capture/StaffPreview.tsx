'use client';

import { useEffect, useRef } from 'react';
import { StaffRenderer } from 'music-engine';
import { toVexFlow } from './usePiano';

const STAFF_ID = 'capture-staff';

export function StaffPreview({ notes }: { notes: number[] }) {
  const renderer = useRef<StaffRenderer | null>(null);

  useEffect(() => {
    renderer.current ??= new StaffRenderer(STAFF_ID);
    renderer.current.render(notes.map(toVexFlow));
  }, [notes]);

  return (
    <div className="custom-scrollbar flex min-h-[230px] items-center justify-center overflow-auto rounded-md border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-2">
      <div id={STAFF_ID} className="mx-auto flex w-full max-w-xs items-center justify-center" />
    </div>
  );
}
