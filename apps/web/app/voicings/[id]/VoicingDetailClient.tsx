'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StaffRenderer } from 'music-engine';
import { Sampler } from 'sampler';

const sampler = new Sampler();
const ARP_STEP_MS = 100;

type Props = {
  vfNotes: string[];
  pitches: string[];
};

export default function VoicingDetailClient({ vfNotes, pitches }: Props) {
  const rendererRef = useRef<StaffRenderer | null>(null);
  const [sampleStatus, setSampleStatus] = useState('Loading Piano…');
  const [isArp, setIsArp] = useState(false);

  useEffect(() => {
    const container = document.getElementById('vexflow-detail');
    if (container && !rendererRef.current) {
      rendererRef.current = new StaffRenderer('vexflow-detail');
    }
    sampler.init();
    sampler
      .loadPianoSamples()
      .then(() => setSampleStatus('Piano Ready'))
      .catch(() => setSampleStatus('Piano Failed (Synth)'));
  }, []);

  useEffect(() => {
    rendererRef.current?.render(vfNotes);
  }, [vfNotes]);

  const handlePlay = useCallback(() => {
    sampler.init();
    if (isArp) {
      vfNotes.forEach((note, i) => {
        setTimeout(() => sampler.play(note), i * ARP_STEP_MS);
      });
    } else {
      vfNotes.forEach((note) => sampler.play(note));
    }
  }, [vfNotes, isArp]);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Staff
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            sampleStatus.includes('Ready')
              ? 'bg-blue-50 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {sampleStatus}
        </span>
      </div>

      <div className="flex min-h-[240px] items-center justify-center px-6 py-6">
        <div id="vexflow-detail" />
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {pitches.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700"
            >
              {p}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isArp}
              onChange={(e) => setIsArp(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Arpeggio
          </label>
          <button
            type="button"
            onClick={handlePlay}
            disabled={vfNotes.length === 0}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Play
          </button>
        </div>
      </div>
    </div>
  );
}
