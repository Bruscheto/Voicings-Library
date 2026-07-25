'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { StaffRenderer } from 'music-engine';
import { Sampler } from 'sampler';
import { canContinuePlayback, describePlaybackStatus } from './playbackStatus';

const sampler = new Sampler();
const ARP_STEP_MS = 100;

type Props = {
  vfNotes: string[];
  pitches: string[];
};

export default function VoicingDetailClient({ vfNotes, pitches }: Props) {
  const rendererRef = useRef<StaffRenderer | null>(null);
  const activationFailedRef = useRef(false);
  const isMountedRef = useRef(false);
  const arpeggioTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const playbackGenerationRef = useRef(0);
  const [sampleStatus, setSampleStatus] = useState('Loading Piano…');
  const [isArp, setIsArp] = useState(false);

  const clearArpeggioTimers = useCallback(() => {
    arpeggioTimersRef.current.forEach(clearTimeout);
    arpeggioTimersRef.current = [];
  }, []);

  const markAudioUnavailable = useCallback(() => {
    activationFailedRef.current = true;
    if (isMountedRef.current) setSampleStatus('Audio Unavailable');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      playbackGenerationRef.current += 1;
      clearArpeggioTimers();
    };
  }, [clearArpeggioTimers]);

  useEffect(() => {
    let cancelled = false;
    const container = document.getElementById('vexflow-detail');
    if (container && !rendererRef.current) {
      rendererRef.current = new StaffRenderer('vexflow-detail');
    }
    sampler.init();
    void sampler
      .loadPianoSamples()
      .then((summary) => {
        if (!cancelled) {
          setSampleStatus(describePlaybackStatus(summary, activationFailedRef.current));
        }
      })
      .catch(() => {
        if (!cancelled) markAudioUnavailable();
      });

    return () => {
      cancelled = true;
    };
  }, [markAudioUnavailable]);

  useEffect(() => {
    rendererRef.current?.render(vfNotes);
  }, [vfNotes]);

  const handlePlay = useCallback(async () => {
    const generation = playbackGenerationRef.current + 1;
    playbackGenerationRef.current = generation;
    clearArpeggioTimers();
    try {
      await sampler.activate();
      if (!canContinuePlayback(generation, playbackGenerationRef.current, isMountedRef.current)) {
        return;
      }
      if (isArp) {
        vfNotes.forEach((note, i) => {
          const timer = setTimeout(() => {
            if (
              !canContinuePlayback(generation, playbackGenerationRef.current, isMountedRef.current)
            ) {
              return;
            }
            void sampler.play(note).catch(() => {
              if (
                canContinuePlayback(generation, playbackGenerationRef.current, isMountedRef.current)
              ) {
                markAudioUnavailable();
              }
            });
          }, i * ARP_STEP_MS);
          arpeggioTimersRef.current.push(timer);
        });
      } else {
        await Promise.all(vfNotes.map((note) => sampler.play(note)));
      }
    } catch {
      if (canContinuePlayback(generation, playbackGenerationRef.current, isMountedRef.current)) {
        markAudioUnavailable();
      }
    }
  }, [clearArpeggioTimers, isArp, markAudioUnavailable, vfNotes]);

  const samplesAvailable =
    sampleStatus === 'Piano Ready' || sampleStatus.startsWith('Piano Partial');

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Staff</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            samplesAvailable ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
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
            onClick={() => void handlePlay()}
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
