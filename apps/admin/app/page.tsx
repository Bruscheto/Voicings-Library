'use client';

import { buildSymbol, chordSegments } from 'data-model/src/canonicalize';
import { StaffRenderer } from 'music-engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sampler } from 'sampler';

const sampler = new Sampler();
const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8
const TENSION_OPTIONS = ['b9', '9', '#9', '11', '#11', 'b13', '13'];
const INTERVAL_TO_TENSION: Record<number, string> = {
  1: 'b9',
  2: '9',
  3: '#9',
  5: '11',
  6: '#11',
  8: 'b13',
  9: '13',
};

// Semitone intervals that are CHORD TONES (skeleton) for each base quality.
// A note matching one of these is part of the chord, not a tension — so on
// m7b5 the 3-semitone tone is the minor 3rd (not #9) and the 6-semitone tone
// is the b5 (not #11). Detection/labeling consult this before INTERVAL_TO_TENSION.
const QUALITY_CHORD_TONES: Record<string, number[]> = {
  Maj: [0, 4, 7],
  Maj7: [0, 4, 7, 11],
  '6': [0, 4, 7, 9],
  '6/9': [0, 2, 4, 7, 9],
  min: [0, 3, 7],
  min7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  '7alt': [0, 4, 7, 10],
  '7sus4': [0, 5, 7, 10],
  '7#5': [0, 4, 8, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  aug7: [0, 4, 8, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  Quartal: [0, 5, 10],
};

// Label for an interval when it IS a chord tone (minor 3rd, b5, #5…).
const CHORD_TONE_LABEL: Record<number, string> = {
  0: 'R',
  1: 'b9',
  2: '9',
  3: 'b3',
  4: '3',
  5: '11',
  6: 'b5',
  7: '5',
  8: '#5',
  9: '13',
  10: 'b7',
  11: '7',
};

// Label for an interval when it is a TENSION (non chord tone).
const TENSION_LABEL: Record<number, string> = {
  0: 'R',
  1: 'b9',
  2: '9',
  3: '#9',
  4: '3',
  5: '11',
  6: '#11',
  7: '5',
  8: 'b13',
  9: '13',
  10: 'b7',
  11: '7',
};
const CONTEXT_OPTIONS = [
  'Rootless',
  'Drop 2',
  'Drop 3',
  'Drop 2 & 4',
  'Upper Structure',
  'Quartal',
  'Shell',
  'Cluster',
  'Open',
  'Close',
  'Poly',
];
const COLLECTION_OPTIONS = ['Rootless ii-V-I', 'Bill Evans left hand', 'Quartal colors'];

// Helper: MIDI Number to Note Name (e.g. 60 -> C4)
const midiToNote = (midi: number) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
};

// Helper: Note Name to VexFlow (e.g. C4 -> c/4, C#4 -> c#/4)
const noteToVexFlow = (note: string) => {
  const match = note.match(/([A-G][#b]?)(\d)/);
  if (!match) return 'c/4';
  return `${match[1].toLowerCase()}/${match[2]}`;
};

// Helper: Note Name to MIDI (e.g. C4 -> 60)
const noteToMidi = (note: string) => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = note.match(/([A-G][#b]?)(\d)/);
  if (!match) return 60;
  const name = match[1];
  const octave = parseInt(match[2]);
  return (octave + 1) * 12 + notes.indexOf(name);
};

// Helper: Root name to pitch class (0-11)
const rootToPitchClass = (rootName: string): number => {
  const map: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };
  return map[rootName] ?? 0;
};

// Helper: label an interval relative to the chord's quality. If the interval is
// part of the chord skeleton it gets its chord-tone name (b3, b5, #5…); only
// genuinely non-chord-tone notes are labeled as tensions (#9, #11, b13…).
const getIntervalLabel = (semitones: number, quality: string): string => {
  const interval = ((semitones % 12) + 12) % 12;
  const chordTones = QUALITY_CHORD_TONES[quality];
  if (chordTones?.includes(interval)) {
    // The diminished 7th (bb7) lands on interval 9 — it's the chord's 7th, not a 13.
    if ((quality === 'dim7' || quality === 'dim') && interval === 9) return 'bb7';
    return CHORD_TONE_LABEL[interval];
  }
  return TENSION_LABEL[interval];
};

// Helper: Analyze all active notes relative to the selected root & quality
const analyzeIntervals = (
  notes: string[],
  rootName: string,
  quality: string,
): { note: string; interval: string }[] => {
  const rootPc = rootToPitchClass(rootName);
  return notes.map((note) => {
    const midi = noteToMidi(note);
    const notePc = midi % 12;
    const semitones = notePc - rootPc;
    return {
      note,
      interval: getIntervalLabel(semitones, quality),
    };
  });
};

// Chord families shown in the picker. The specific quality (7th type, sus,
// half- vs fully-diminished, sixth) is detected from the played notes.
const FAMILIES: { value: string; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: 'dominant', label: 'Dominant' },
  { value: 'diminished', label: 'Diminished' },
  { value: 'augmented', label: 'Augmented' },
  { value: 'quartal', label: 'Quartal' },
];

// Detect the specific base quality from the chosen family + the intervals
// actually present (relative to root). The family fixes the 3rd/5th; the played
// 6th/7th selects the exact quality. When no 7th/6th is present it falls back to
// the triad — except dominant, which always implies the b7 (→ "7").
// `hasCloseAlteredFifth`: a note 8 semitones above the root that is voiced
// within an octave of the bass. On a dominant with no natural 5th that note is
// the #5 (→ 7#5); voiced an octave or more above the bass it is instead a b13
// tension on a plain 7. (e.g. G B D# F = G7#5, but C E Bb Db Ab = C7b9b13.)
const detectQuality = (
  family: string,
  intervals: Set<number>,
  hasCloseAlteredFifth: boolean,
): string => {
  const has = (i: number) => intervals.has(i);
  switch (family) {
    case 'minor':
      if (has(11)) return 'mMaj7';
      if (has(10)) return 'min7';
      if (has(9)) return 'm6';
      return 'min';
    case 'dominant':
      if (has(5) && !has(4)) return '7sus4';
      if (!has(7) && hasCloseAlteredFifth) return '7#5';
      return '7';
    case 'diminished':
      if (has(10)) return 'm7b5'; // half-diminished (natural b7)
      if (has(9)) return 'dim7'; // fully diminished (bb7)
      return 'dim';
    case 'augmented':
      if (has(10)) return 'aug7';
      return 'aug';
    case 'quartal':
      return 'Quartal';
    case 'major':
    default:
      if (has(11)) return 'Maj7';
      if (has(9)) return '6';
      return 'Maj';
  }
};

export default function AdminPage() {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [midiStatus, setMidiStatus] = useState<string>('Connecting...');
  const [sampleStatus, setSampleStatus] = useState<string>('Loading Piano...');
  const rendererRef = useRef<StaffRenderer | null>(null);

  // Form State
  const [voicingName, setVoicingName] = useState('Rootless');
  const [saveStatus, setSaveStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isArp, setIsArp] = useState(false);
  const [collectionOptions, setCollectionOptions] = useState<string[]>(COLLECTION_OPTIONS);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([COLLECTION_OPTIONS[0]]);
  const [newCollectionName, setNewCollectionName] = useState('');

  const SAVE_TIMEOUT_MS = 10_000;

  // Chord Builder State
  const [root, setRoot] = useState('C');
  const [family, setFamily] = useState('major');
  const [autoBassEnabled, setAutoBassEnabled] = useState(true);
  const [manualBass, setManualBass] = useState('None');
  const [autoTensionEnabled, setAutoTensionEnabled] = useState(true);
  const [manualTensions, setManualTensions] = useState<string[]>([]);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [autoNameEnabled, setAutoNameEnabled] = useState(true);

  const handleReset = () => setActiveNotes(new Set());

  const toggleCollection = (collection: string) => {
    setSelectedCollections((prev) =>
      prev.includes(collection)
        ? prev.filter((item) => item !== collection)
        : [...prev, collection],
    );
  };

  const handleAddCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;

    setCollectionOptions((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedCollections((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setNewCollectionName('');
  };

  const shiftActiveNotes = useCallback(
    (delta: number) => {
      if (activeNotes.size === 0 || delta === 0) {
        return;
      }

      const midiValues = Array.from(activeNotes).map(noteToMidi);
      const maxMidi = Math.max(...midiValues);
      const minMidi = Math.min(...midiValues);

      if (delta > 0 && maxMidi + delta > MAX_MIDI) {
        return;
      }
      if (delta < 0 && minMidi + delta < MIN_MIDI) {
        return;
      }

      const shiftedNotes = midiValues.map((midi) => midiToNote(midi + delta));
      setActiveNotes(new Set(shiftedNotes));
    },
    [activeNotes],
  );

  const sortedActiveNotes = useMemo(
    () => Array.from(activeNotes).sort((a, b) => noteToMidi(a) - noteToMidi(b)),
    [activeNotes],
  );

  // Specific quality is derived from the family + the played notes.
  const quality = useMemo(() => {
    const rootPc = rootToPitchClass(root);
    const midis = sortedActiveNotes.map(noteToMidi);
    const bassMidi = midis.length ? Math.min(...midis) : 0;
    const intervals = new Set(midis.map((m) => ((m % 12) - rootPc + 12) % 12));
    // Altered 5th voiced within an octave of the bass → #5 (else it's a b13).
    const hasCloseAlteredFifth = midis.some(
      (m) => ((m % 12) - rootPc + 12) % 12 === 8 && m - bassMidi < 12,
    );
    return detectQuality(family, intervals, hasCloseAlteredFifth);
  }, [family, sortedActiveNotes, root]);

  const autoBassInfo = useMemo(() => {
    if (!sortedActiveNotes.length) {
      return null;
    }
    const lowest = sortedActiveNotes[0];
    const lowestPc = noteToMidi(lowest) % 12;
    const rootPc = rootToPitchClass(root);
    const letter = lowest.match(/([A-G][#b]?)/)?.[1] ?? lowest;
    return {
      full: lowest,
      letter,
      isSlash: lowestPc !== rootPc,
    };
  }, [sortedActiveNotes, root]);

  const slashBass = useMemo(() => {
    if (autoBassEnabled) {
      return autoBassInfo?.isSlash ? autoBassInfo.letter : null;
    }
    return manualBass !== 'None' ? manualBass : null;
  }, [autoBassEnabled, autoBassInfo, manualBass]);

  const autoTensions = useMemo(() => {
    if (!autoTensionEnabled || !sortedActiveNotes.length) {
      return [];
    }
    const rootPc = rootToPitchClass(root);
    const chordTones = new Set(QUALITY_CHORD_TONES[quality] ?? []);
    const detected = new Set<string>();
    sortedActiveNotes.forEach((note) => {
      const midi = noteToMidi(note);
      const interval = ((midi % 12) - rootPc + 12) % 12;
      // Skip chord tones — e.g. the m3/b5 of an m7b5 are not #9/#11 tensions.
      if (chordTones.has(interval)) {
        return;
      }
      const tension = INTERVAL_TO_TENSION[interval];
      if (tension) {
        detected.add(tension);
      }
    });
    return TENSION_OPTIONS.filter((option) => detected.has(option));
  }, [autoTensionEnabled, sortedActiveNotes, root, quality]);

  const appliedTensions = autoTensionEnabled ? autoTensions : manualTensions;
  const appliedContexts = contextEnabled ? selectedContexts : [];

  const intervalAnalysis = useMemo(
    () =>
      sortedActiveNotes.length ? analyzeIntervals(sortedActiveNotes, root, quality) : [],
    [sortedActiveNotes, root, quality],
  );

  const intervalMap = useMemo(() => {
    const map = new Map<string, string>();
    intervalAnalysis.forEach(({ note, interval }) => map.set(note, interval));
    return map;
  }, [intervalAnalysis]);

  const roots = [
    'C',
    'C#',
    'Db',
    'D',
    'D#',
    'Eb',
    'E',
    'F',
    'F#',
    'Gb',
    'G',
    'G#',
    'Ab',
    'A',
    'A#',
    'Bb',
    'B',
  ];
  // Base qualities only — compound extensions (Maj9/Maj13/min9/min11/min13/9/13)
  // are expressed as a base quality plus tensions, then lifted for display.
  const bassNotes = ['None', ...roots];

  // Canonical chord symbol (matches server-side canonicalization).
  const computedSymbol = useMemo(
    () => buildSymbol(root, quality, appliedTensions, slashBass),
    [root, quality, appliedTensions, slashBass],
  );
  const previewSegments = useMemo(
    () => chordSegments(root, quality, appliedTensions, slashBass),
    [root, quality, appliedTensions, slashBass],
  );

  useEffect(() => {
    if (autoNameEnabled) {
      setVoicingName(computedSymbol);
    }
  }, [autoNameEnabled, computedSymbol]);

  // Initialize Sampler & Renderer
  useEffect(() => {
    const container = document.getElementById('vexflow-admin');
    if (container && !rendererRef.current) {
      rendererRef.current = new StaffRenderer('vexflow-admin');
    }
    sampler.init();
    sampler
      .loadPianoSamples()
      .then(() => setSampleStatus('Piano Ready'))
      .catch(() => setSampleStatus('Piano Failed (Synth)'));
  }, []);

  // Update Renderer when notes change
  useEffect(() => {
    if (rendererRef.current) {
      const vfNotes = sortedActiveNotes.map(noteToVexFlow);
      rendererRef.current.render(vfNotes);
    }
  }, [sortedActiveNotes]);

  // MIDI Setup
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).requestMIDIAccess) {
      (navigator as any).requestMIDIAccess().then(
        (midiAccess: any) => {
          setMidiStatus('MIDI Ready');
          const inputs = midiAccess.inputs.values();
          for (let input of inputs) {
            input.onmidimessage = handleMidiMessage;
          }
          midiAccess.onstatechange = (e: any) => {
            console.log('MIDI State Change', e);
          };
        },
        () => setMidiStatus('MIDI Failed / Not Supported'),
      );
    } else {
      setMidiStatus('Web MIDI API not supported');
    }
  }, []);

  const handleMidiMessage = (message: any) => {
    const [command, note, velocity] = message.data;

    // Note On (144) with velocity > 0
    if (command === 144 && velocity > 0) {
      const noteName = midiToNote(note);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(noteName);
        return next;
      });
      sampler.play(noteToVexFlow(noteName));
    }
    // Note Off (128) or Note On with velocity 0
    else if (command === 128 || (command === 144 && velocity === 0)) {
      const noteName = midiToNote(note);
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(noteName);
        return next;
      });
    }
  };

  const toggleNote = (note: string) => {
    sampler.init();
    setActiveNotes((prev) => {
      const next = new Set(prev);
      if (next.has(note)) {
        next.delete(note);
      } else {
        next.add(note);
        sampler.play(noteToVexFlow(note));
      }
      return next;
    });
  };

  const handlePlay = useCallback(() => {
    sampler.init();
    const vfNotes = sortedActiveNotes.map(noteToVexFlow);

    if (isArp) {
      vfNotes.forEach((note, index) => {
        setTimeout(() => sampler.play(note), index * 100);
      });
    } else {
      vfNotes.forEach((note) => sampler.play(note));
    }
  }, [sortedActiveNotes, isArp]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = document.activeElement?.tagName;
      const inInput = targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA';
      if (inInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlay();
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        shiftActiveNotes(12);
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        shiftActiveNotes(-12);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlay, shiftActiveNotes]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatus('Saving...');

    const pitches = sortedActiveNotes;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/voicings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          quality,
          root,
          tensions: appliedTensions,
          voicingName,
          pitches,
          slashBass,
          contextTags: appliedContexts,
          collections: selectedCollections,
        }),
      });

      if (res.ok) {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      } else if (res.status === 409) {
        setSaveStatus('Already in collection');
      } else {
        setSaveStatus(`Save failed (${res.status}) — retry`);
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') {
        setSaveStatus('Save timed out — retry');
      } else {
        setSaveStatus('Network error — retry');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSaving(false);
    }
  };

  // Virtual Piano Keys (A0 to C8)
  const pianoKeys = [];
  const startMidi = MIN_MIDI;
  const endMidi = MAX_MIDI;
  let whiteKeyCount = 0;

  for (let i = startMidi; i <= endMidi; i++) {
    const note = midiToNote(i);
    const isBlack = note.includes('#');
    if (!isBlack) {
      pianoKeys.push({ note, midi: i, isBlack, leftOffset: whiteKeyCount * 44 });
      whiteKeyCount++;
    } else {
      // Black key is positioned relative to the previous white key
      pianoKeys.push({ note, midi: i, isBlack, leftOffset: whiteKeyCount * 44 - 13 });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              Personal voicing library
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
              Add Voicing
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${sampleStatus.includes('Ready') ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              {sampleStatus}
            </div>
            <div
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${midiStatus.includes('Ready') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
            >
              {midiStatus}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <div className="contents">
            <div className="order-1 flex h-auto flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:col-span-5 xl:h-[400px]">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex flex-wrap items-baseline gap-1 text-2xl font-semibold tracking-tight text-gray-900">
                    {previewSegments.map((seg, i) => (
                      <span key={i}>{seg}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePlay}
                    disabled={activeNotes.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M6.3 3.6a1 1 0 0 0-1.5.87v11.06a1 1 0 0 0 1.5.87l9.4-5.53a1 1 0 0 0 0-1.74L6.3 3.6Z" />
                    </svg>
                    Play
                  </button>
                  <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isArp}
                      onChange={(e) => setIsArp(e.target.checked)}
                      className="rounded text-emerald-700 focus:ring-emerald-700"
                    />
                    Arpeggio
                  </label>
                </div>
              </div>
              <div className="custom-scrollbar relative min-h-[250px] flex-1 overflow-auto rounded-md border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-2">
                <div id="vexflow-admin" className="mx-auto flex w-full max-w-xs items-center justify-center"></div>
              </div>
            </div>

            <div className="order-3 rounded-2xl border border-gray-200 bg-white p-4 text-gray-900 shadow-sm xl:col-span-12">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Keyboard input</h2>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-md border border-gray-200 bg-white/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-white"
                >
                  Reset
                </button>
              </div>
              <div className="relative h-64 overflow-hidden rounded-md border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 select-none">
                <div className="custom-scrollbar h-full overflow-x-auto">
                  <div className="relative h-full" style={{ width: `${whiteKeyCount * 44}px` }}>
                    {pianoKeys
                      .filter((k) => !k.isBlack)
                      .map((key) => {
                        const isActive = activeNotes.has(key.note);
                        const intervalLabel = intervalMap.get(key.note);
                        const isCLabel = /^C\d$/.test(key.note);
                        const showPitchLabel = isActive || isCLabel;
                        const displayNote = isCLabel ? key.note : key.note.replace(/\d+$/, '');
                        return (
                          <div
                            key={key.note}
                            style={{ left: `${key.leftOffset}px`, width: '44px' }}
                            className="absolute top-0 flex flex-col items-center"
                          >
                            <button
                              type="button"
                              onMouseDown={() => toggleNote(key.note)}
                              className={`flex h-44 w-11 flex-col items-center justify-end rounded-b-md border pb-2 transition ${isActive ? 'border-purple-400 bg-purple-100 text-purple-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-white'}`}
                            >
                              {showPitchLabel && (
                                <span
                                  className={`font-mono text-[12px] leading-4 ${isActive ? 'font-semibold text-purple-900' : 'font-medium text-gray-600'}`}
                                >
                                  {displayNote}
                                </span>
                              )}
                            </button>
                            {isActive && intervalLabel && (
                              <div className="mt-1 text-xs font-semibold text-purple-600">
                                {intervalLabel}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {pianoKeys
                      .filter((k) => k.isBlack)
                      .map((key) => {
                        const isActive = activeNotes.has(key.note);
                        const intervalLabel = intervalMap.get(key.note);
                        const displayNote = key.note.replace(/\d+$/, '');
                        return (
                          <div
                            key={key.note}
                            style={{ left: `${key.leftOffset}px`, width: '26px' }}
                            className="absolute top-0 z-10 flex flex-col items-center"
                          >
                            <button
                              type="button"
                              onMouseDown={() => toggleNote(key.note)}
                              className={`flex h-28 w-[26px] items-end justify-center rounded-b-md border pb-2 transition ${isActive ? 'border-purple-600 bg-purple-600' : 'border-gray-900 bg-gray-900 hover:bg-gray-800'}`}
                            >
                              <span
                                className={`font-mono text-[12px] leading-4 ${isActive ? 'font-semibold text-white' : 'text-gray-300 opacity-0'}`}
                              >
                                {displayNote}
                              </span>
                            </button>
                            {isActive && intervalLabel && (
                              <div className="mt-1 text-xs font-semibold text-purple-600">
                                {intervalLabel}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  Shift
                </span>
                <button
                  type="button"
                  onClick={() => shiftActiveNotes(12)}
                  disabled={activeNotes.size === 0}
                  className="rounded-md border border-gray-200 bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Octave +12
                </button>
                <button
                  type="button"
                  onClick={() => shiftActiveNotes(-12)}
                  disabled={activeNotes.size === 0}
                  className="rounded-md border border-gray-200 bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Octave -12
                </button>
                <button
                  type="button"
                  onClick={() => shiftActiveNotes(1)}
                  disabled={activeNotes.size === 0}
                  className="rounded-md border border-gray-200 bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Semitone +1
                </button>
                <button
                  type="button"
                  onClick={() => shiftActiveNotes(-1)}
                  disabled={activeNotes.size === 0}
                  className="rounded-md border border-gray-200 bg-white/60 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Semitone -1
                </button>
              </div>
              <div className="mt-3 border-t border-gray-200 pt-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                  Interval analysis
                </h2>
                {activeNotes.size === 0 ? (
                  <div className="mt-2 rounded-md border border-dashed border-gray-200 bg-white/45 px-3 py-2 text-sm text-gray-500">
                    Select notes to inspect interval roles.
                  </div>
                ) : (
                  <div className="mt-2 flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto">
                    {intervalAnalysis.map(({ note, interval }) => (
                      <span
                        key={note}
                        className="inline-flex items-baseline gap-1 rounded-md border border-gray-200 bg-white/55 px-2 py-0.5"
                      >
                        <span className="font-mono text-[11px] text-gray-500">{note}</span>
                        <span className="text-[11px] font-bold text-purple-700">{interval}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="order-2 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_280px] xl:col-span-7">
            <section className="flex h-auto flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:h-[400px]">
              <div className="mb-4 border-b border-gray-200 pb-3">
                <h2 className="text-base font-semibold tracking-tight text-gray-900">
                  Chord details
                </h2>
              </div>
              <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Root
                    </label>
                    <select
                      value={root}
                      onChange={(e) => setRoot(e.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      {roots.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Quality
                    </label>
                    <select
                      value={family}
                      onChange={(e) => setFamily(e.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      {FAMILIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                        Tensions
                      </span>
                      <button
                        type="button"
                        onClick={() => setAutoTensionEnabled((prev) => !prev)}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${autoTensionEnabled ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                      >
                        {autoTensionEnabled ? 'Auto' : 'Manual'}
                      </button>
                    </div>
                    {!autoTensionEnabled && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {TENSION_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setManualTensions((prev) =>
                                prev.includes(option)
                                  ? prev.filter((item) => item !== option)
                                  : [...prev, option],
                              )
                            }
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${manualTensions.includes(option) ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                        Slash bass
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAutoBassEnabled((prev) => !prev);
                          if (!autoBassEnabled) setManualBass('None');
                        }}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${autoBassEnabled ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                      >
                        {autoBassEnabled ? 'Auto' : 'Manual'}
                      </button>
                    </div>
                    {!autoBassEnabled && (
                      <select
                        value={manualBass}
                        onChange={(e) => setManualBass(e.target.value)}
                        className="mt-3 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm font-medium text-gray-800 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                      >
                        {bassNotes.map((note) => (
                          <option key={note} value={note}>
                            {note}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      Voicing name
                    </label>
                    <button
                      type="button"
                      onClick={() => setAutoNameEnabled((prev) => !prev)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${autoNameEnabled ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      {autoNameEnabled ? 'Auto' : 'Manual'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={voicingName}
                    onChange={(e) => setVoicingName(e.target.value)}
                    disabled={autoNameEnabled}
                    className={`w-full rounded-md border border-gray-200 px-2.5 py-2 text-sm font-medium outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${autoNameEnabled ? 'cursor-not-allowed bg-gray-100 text-gray-500' : 'bg-white text-gray-800'}`}
                    placeholder="Rootless A"
                  />
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      Context tags
                    </span>
                    <button
                      type="button"
                      onClick={() => setContextEnabled((prev) => !prev)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition ${contextEnabled ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                    >
                      {contextEnabled ? 'On' : 'Add'}
                    </button>
                  </div>
                  {contextEnabled && (
                    <div className="flex flex-wrap gap-1.5">
                      {CONTEXT_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setSelectedContexts((prev) =>
                              prev.includes(option)
                                ? prev.filter((item) => item !== option)
                                : [...prev, option],
                            )
                          }
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${selectedContexts.includes(option) ? 'border-purple-400 bg-purple-100 text-purple-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="flex h-auto flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:h-[400px]">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">My Library</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Private by default. Add it to one or more collections now, publish lists later.
                </p>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {collectionOptions.map((collection) => {
                  const selected = selectedCollections.includes(collection);
                  return (
                    <button
                      key={collection}
                      type="button"
                      onClick={() => toggleCollection(collection)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${selected ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-white'}`}
                    >
                      {collection}
                    </button>
                  );
                })}
              </div>
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCollection();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-600"
                  placeholder="New collection"
                />
                <button
                  type="button"
                  onClick={handleAddCollection}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={activeNotes.size === 0 || isSaving}
                className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {isSaving && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {saveStatus ||
                  `Save to ${selectedCollections.length || 'My Library'}${selectedCollections.length === 1 ? ' Collection' : selectedCollections.length > 1 ? ' Collections' : ''}`}
              </button>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
