'use client';

import { useEffect, useRef } from 'react';
import { midiToPitch, spellMidi, type Degree, type SpellingChord } from 'harmony';
import { MAX_MIDI, MIN_MIDI } from './useCapturedNotes';

const WHITE_KEY_WIDTH = 44;
const BLACK_KEY_WIDTH = 26;
const BLACK_KEY_OFFSET = 13;
const MIDDLE_C = 60;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

type Key = { midi: number; isBlack: boolean; left: number };

const KEYS: Key[] = (() => {
  const keys: Key[] = [];
  let whites = 0;
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
    const isBlack = BLACK_PCS.has(midi % 12);
    keys.push({
      midi,
      isBlack,
      left: isBlack ? whites * WHITE_KEY_WIDTH - BLACK_KEY_OFFSET : whites * WHITE_KEY_WIDTH,
    });
    if (!isBlack) whites++;
  }
  return keys;
})();
const TOTAL_WIDTH = KEYS.filter((k) => !k.isBlack).length * WHITE_KEY_WIDTH;

type Props = {
  notes: number[];
  degrees: Map<number, Degree>;
  onToggle: (midi: number) => void;
  /** Name selected keys as members of this chord. */
  chord?: SpellingChord | null;
};

export function PianoKeyboard({ notes, degrees, onToggle, chord }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const active = new Set(notes);

  // Keep the played notes in view; start centred on middle C.
  const focus = notes.length ? notes[Math.floor(notes.length / 2)] : MIDDLE_C;
  const centred = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    const key = KEYS.find((k) => k.midi === focus);
    if (!el || !key) return;
    const target = key.left - el.clientWidth / 2;
    if (!centred.current) {
      el.scrollLeft = target;
      centred.current = true;
    } else if (Math.abs(el.scrollLeft - target) > el.clientWidth / 3) {
      el.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, [focus]);

  const renderKey = (key: Key) => {
    const isActive = active.has(key.midi);
    const degree = degrees.get(key.midi);
    const pitch = midiToPitch(key.midi);
    // Selected keys show their name; idle keys show only the Cs, with octave.
    const spelled = isActive && chord ? spellMidi(key.midi, chord) : pitch;
    const label = isActive ? spelled.replace(/-?\d+$/, '') : /^C\d$/.test(pitch) ? pitch : null;
    const tone = degree?.isGuideTone
      ? key.isBlack
        ? 'border-amber-600 bg-amber-500 text-white'
        : 'border-amber-400 bg-amber-100 text-amber-900'
      : key.isBlack
        ? 'border-purple-600 bg-purple-600 text-white'
        : 'border-purple-400 bg-purple-100 text-purple-900';
    const idle = key.isBlack
      ? 'border-gray-900 bg-gray-900 hover:bg-gray-800'
      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50';
    return (
      <div
        key={key.midi}
        style={{ left: key.left, width: key.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH }}
        className={`absolute top-0 flex flex-col items-center ${key.isBlack ? 'z-10' : ''}`}
      >
        <button
          type="button"
          data-key-color={key.isBlack ? 'black' : 'white'}
          aria-label={`${pitch}${isActive ? ', selected' : ''}${degree ? `, ${degree.label}` : ''}`}
          aria-pressed={isActive}
          onMouseDown={(e) => {
            e.preventDefault(); // toggle on press without stealing focus from shortcuts
            onToggle(key.midi);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            onToggle(key.midi);
          }}
          className={`flex flex-col items-center justify-end rounded-b-md border pb-2 transition ${
            key.isBlack ? 'h-28 w-[26px]' : 'h-44 w-11'
          } ${isActive ? tone : idle}`}
        >
          {label && (
            <span className={`font-mono text-[11px] leading-4 ${isActive ? 'font-semibold' : ''}`}>
              {label}
            </span>
          )}
        </button>
        {isActive && degree && (
          <span
            className={`mt-1 text-xs font-bold ${degree.isGuideTone ? 'text-amber-600' : 'text-purple-600'}`}
          >
            {degree.label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="instrument-keyboard relative h-56 overflow-hidden rounded-md border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 select-none">
      <div ref={scroller} className="custom-scrollbar h-full overflow-x-auto">
        <div className="relative h-full" style={{ width: TOTAL_WIDTH }}>
          {KEYS.filter((k) => !k.isBlack).map(renderKey)}
          {KEYS.filter((k) => k.isBlack).map(renderKey)}
        </div>
      </div>
    </div>
  );
}
