'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StaffRenderer } from 'music-engine';
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
    9: '13'
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
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    return map[rootName] ?? 0;
};

type ChordFamily = 'major' | 'minor' | 'dominant' | 'diminished' | 'augmented' | 'other';

const detectChordFamily = (quality: string): ChordFamily => {
    const q = quality.toLowerCase();
    if (q.includes('mmaj') || q.startsWith('m') || q.includes('min') || q.includes('m7b5')) {
        return 'minor';
    }
    if (q.includes('dim')) {
        return 'diminished';
    }
    if (q.includes('aug')) {
        return 'augmented';
    }
    if (q.includes('7') && !q.includes('maj') && !q.includes('dim') && !q.includes('min') && !q.startsWith('m')) {
        return 'dominant';
    }
    if (q.includes('maj') || q.includes('6') || q.includes('quartal')) {
        return 'major';
    }
    return 'other';
};

const hasTension = (tensions: string[], target: string) => tensions.map(t => t.toLowerCase()).includes(target.toLowerCase());

// Helper: Interval analysis aware of chord context
const getIntervalLabel = (semitones: number, family: ChordFamily, tensions: string[]): string => {
    const interval = ((semitones % 12) + 12) % 12;
    switch (interval) {
        case 0:
            return 'R';
        case 1:
            return 'b9';
        case 2:
            return '9';
        case 3:
            if (hasTension(tensions, '#9') || family === 'dominant' || family === 'augmented') return '#9';
            return 'b3';
        case 4:
            return '3';
        case 5:
            return '11';
        case 6:
            if (hasTension(tensions, '#11') || family === 'major' || family === 'dominant') return '#11';
            return 'b5';
        case 7:
            return '5';
        case 8:
            if (hasTension(tensions, 'b13') || family === 'major' || family === 'dominant') return 'b13';
            return '#5';
        case 9:
            return '13';
        case 10:
            return 'b7';
        case 11:
            return '7';
        default:
            return `+${interval}`;
    }
};

// Helper: Analyze all active notes relative to the selected root & quality
const analyzeIntervals = (notes: string[], rootName: string, quality: string, tensions: string[]): { note: string; interval: string }[] => {
    const rootPc = rootToPitchClass(rootName);
    const family = detectChordFamily(quality);
    return notes.map(note => {
        const midi = noteToMidi(note);
        const notePc = midi % 12;
        const semitones = notePc - rootPc;
        return {
            note,
            interval: getIntervalLabel(semitones, family, tensions)
        };
    });
};

// (Removed duplicate helper definitions)

export default function AdminPage() {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [midiStatus, setMidiStatus] = useState<string>('Connecting...');
  const [sampleStatus, setSampleStatus] = useState<string>('Loading Piano...');
  const rendererRef = useRef<StaffRenderer | null>(null);
  
  // Form State
  const [voicingName, setVoicingName] = useState('Rootless');
  const [saveStatus, setSaveStatus] = useState('');
  const [isArp, setIsArp] = useState(false);

  // Chord Builder State
    const [root, setRoot] = useState('C');
    const [quality, setQuality] = useState('Maj7');
    const [autoBassEnabled, setAutoBassEnabled] = useState(true);
    const [manualBass, setManualBass] = useState('None');
    const [autoTensionEnabled, setAutoTensionEnabled] = useState(true);
    const [manualTensions, setManualTensions] = useState<string[]>([]);
    const [contextEnabled, setContextEnabled] = useState(false);
    const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
    const [autoNameEnabled, setAutoNameEnabled] = useState(true);

  const handleReset = () => setActiveNotes(new Set());

  const shiftActiveNotes = useCallback((delta: number) => {
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

      const shiftedNotes = midiValues.map(midi => midiToNote(midi + delta));
      setActiveNotes(new Set(shiftedNotes));
    }, [activeNotes]);

  const sortedActiveNotes = useMemo(
      () => Array.from(activeNotes).sort((a, b) => noteToMidi(a) - noteToMidi(b)),
      [activeNotes]
  );

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
          isSlash: lowestPc !== rootPc
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
      const detected = new Set<string>();
      sortedActiveNotes.forEach(note => {
          const midi = noteToMidi(note);
          const interval = ((midi % 12) - rootPc + 12) % 12;
          const tension = INTERVAL_TO_TENSION[interval];
          if (tension) {
              detected.add(tension);
          }
      });
      return TENSION_OPTIONS.filter(option => detected.has(option));
  }, [autoTensionEnabled, sortedActiveNotes, root]);

  const appliedTensions = autoTensionEnabled ? autoTensions : manualTensions;
    const appliedContexts = contextEnabled ? selectedContexts : [];

  const intervalAnalysis = useMemo(
      () => sortedActiveNotes.length
          ? analyzeIntervals(sortedActiveNotes, root, quality, appliedTensions)
          : [],
      [sortedActiveNotes, root, quality, appliedTensions]
  );

  const intervalMap = useMemo(() => {
      const map = new Map<string, string>();
      intervalAnalysis.forEach(({ note, interval }) => map.set(note, interval));
      return map;
  }, [intervalAnalysis]);

    const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
    const qualities = ['Maj', 'Maj7', '6', '6/9', 'min', 'min7', 'mMaj7', 'm6', '7', '7alt', '7sus4', 'dim', 'dim7', 'm7b5', 'aug', 'aug7', 'Quartal'];
    const bassNotes = ['None', ...roots];

  // Computed Symbol
  const computedSymbol = (() => {
      let s = `${root}${quality}`;
      if (appliedTensions.length > 0) {
          s += `(${appliedTensions.join(',')})`;
      }
      if (slashBass) {
          s += `/${slashBass}`;
      }
      return s;
  })();

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
    sampler.loadPianoSamples()
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
              console.log("MIDI State Change", e);
          };
        },
        () => setMidiStatus('MIDI Failed / Not Supported')
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
      setActiveNotes(prev => {
        const next = new Set(prev);
        next.add(noteName);
        return next;
      });
      sampler.play(noteToVexFlow(noteName));
    }
    // Note Off (128) or Note On with velocity 0
    else if (command === 128 || (command === 144 && velocity === 0)) {
      const noteName = midiToNote(note);
      setActiveNotes(prev => {
        const next = new Set(prev);
        next.delete(noteName);
        return next;
      });
    }
  };

  const toggleNote = (note: string) => {
    sampler.init();
    setActiveNotes(prev => {
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
          vfNotes.forEach(note => sampler.play(note));
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
    setSaveStatus('Saving...');
    const pitches = sortedActiveNotes;
    const midiNumbers = pitches.map(noteToMidi);

    try {
      const res = await fetch('/api/voicings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: computedSymbol,
          quality,
          root,
          tensions: appliedTensions.join(','),
          voicingName,
          pitches,
          midiNumbers,
                    context: 'manual',
                    contextTags: appliedContexts
        })
      });
      
      if (res.ok) {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('Error saving');
      }
    } catch (e) {
      setSaveStatus('Error saving');
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
          pianoKeys.push({ note, midi: i, isBlack, leftOffset: whiteKeyCount * 40 });
          whiteKeyCount++;
      } else {
          // Black key is positioned relative to the previous white key
          pianoKeys.push({ note, midi: i, isBlack, leftOffset: (whiteKeyCount * 40) - 12 });
      }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 20px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
            background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-xl p-8">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Voicing Capture Tool</h1>
            <div className="flex gap-2">
                <div className={`px-3 py-1 rounded-full text-sm ${sampleStatus.includes('Ready') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {sampleStatus}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm ${midiStatus.includes('Ready') ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {midiStatus}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Left: Staff Preview */}
            <div className="border rounded-lg p-4 bg-white flex justify-center items-center min-h-[200px]">
                <div id="vexflow-admin"></div>
            </div>

            {/* Right: Metadata Form */}
            <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Chord Symbol</label>
                    </div>
                    <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="w-1/3">
                                    <label className="text-xs text-gray-500 block mb-1">Root</label>
                                    <select 
                                        value={root} 
                                        onChange={e => setRoot(e.target.value)}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                        {roots.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="w-2/3">
                                    <label className="text-xs text-gray-500 block mb-1">Quality</label>
                                    <select 
                                        value={quality} 
                                        onChange={e => setQuality(e.target.value)}
                                        className="w-full px-2 py-1 border rounded text-sm"
                                    >
                                        {qualities.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Auto Tension</span>
                                    <button
                                        type="button"
                                        onClick={() => setAutoTensionEnabled(prev => !prev)}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md border ${autoTensionEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                    >
                                        {autoTensionEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                                {!autoTensionEnabled && (
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Tensions</label>
                                        <div className="flex flex-wrap gap-2">
                                            {TENSION_OPTIONS.map(option => (
                                                <button
                                                    key={option}
                                                    onClick={() => {
                                                        setManualTensions(prev => (
                                                            prev.includes(option)
                                                                ? prev.filter(item => item !== option)
                                                                : [...prev, option]
                                                        ));
                                                    }}
                                                    className={`px-2 py-1 text-xs rounded border ${
                                                        manualTensions.includes(option)
                                                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Auto Bass</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAutoBassEnabled(prev => !prev);
                                            if (!autoBassEnabled) {
                                                setManualBass('None');
                                            }
                                        }}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md border ${autoBassEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                    >
                                        {autoBassEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                                {!autoBassEnabled && (
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Manual Bass / Slash</label>
                                        <select
                                            value={manualBass}
                                            onChange={e => setManualBass(e.target.value)}
                                            className="w-full px-2 py-1 border rounded text-sm"
                                        >
                                            {bassNotes.map(note => (
                                                <option key={note} value={note}>{note}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Context</span>
                                    <button
                                        type="button"
                                        onClick={() => setContextEnabled(prev => !prev)}
                                        className={`px-3 py-1 text-xs font-semibold rounded-md border ${contextEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                                    >
                                        {contextEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                                {contextEnabled && (
                                    <div className="flex flex-wrap gap-2">
                                        {CONTEXT_OPTIONS.map(option => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedContexts(prev => (
                                                        prev.includes(option)
                                                            ? prev.filter(item => item !== option)
                                                            : [...prev, option]
                                                    ));
                                                }}
                                                className={`px-2 py-1 text-xs rounded border ${
                                                    selectedContexts.includes(option)
                                                        ? 'bg-purple-100 border-purple-300 text-purple-800'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 border-t border-gray-200">
                                <p className="text-sm text-gray-500">Preview: <span className="font-bold text-gray-800">{computedSymbol}</span></p>
                            </div>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">Voicing Name</label>
                        <button
                            type="button"
                            onClick={() => setAutoNameEnabled(prev => !prev)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md border ${autoNameEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                            {autoNameEnabled ? 'Auto' : 'Manual'}
                        </button>
                    </div>
                    <input 
                        type="text" 
                        value={voicingName} 
                        onChange={e => setVoicingName(e.target.value)}
                        disabled={autoNameEnabled}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none ${autoNameEnabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="e.g. Rootless A"
                    />
                </div>
                
                <button 
                    onClick={handleSave}
                    disabled={activeNotes.size === 0}
                    className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {saveStatus || 'Save Voicing'}
                </button>

                <div className="flex gap-2 items-center pt-2 border-t border-gray-200">
                    <button
                        onClick={handlePlay}
                        disabled={activeNotes.size === 0}
                        className="flex-1 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Play (Space)
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            checked={isArp} 
                            onChange={e => setIsArp(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        Arpeggio
                    </label>
                </div>
            </div>
        </div>

        {/* Pitch Tools */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Pitch Tools</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Octave</span>
                    <button
                        onClick={() => shiftActiveNotes(12)}
                        disabled={activeNotes.size === 0}
                        className="px-2 py-1 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        +12
                    </button>
                    <button
                        onClick={() => shiftActiveNotes(-12)}
                        disabled={activeNotes.size === 0}
                        className="px-2 py-1 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        -12
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Semitone</span>
                    <button
                        onClick={() => shiftActiveNotes(1)}
                        disabled={activeNotes.size === 0}
                        className="px-2 py-1 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        +1
                    </button>
                    <button
                        onClick={() => shiftActiveNotes(-1)}
                        disabled={activeNotes.size === 0}
                        className="px-2 py-1 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        -1
                    </button>
                </div>
            </div>
        </div>

        {/* Virtual Piano */}
        <div className="flex justify-between items-center mt-6 mb-2">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Keyboard</h2>
            <button
                onClick={handleReset}
                className="px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
                Reset
            </button>
        </div>
        <div className="relative h-56 bg-gray-100 rounded-lg overflow-hidden border-t-4 border-gray-800 select-none flex flex-col">
             <div className="overflow-x-auto custom-scrollbar flex-1 relative">
                 <div className="relative h-full" style={{ width: `${whiteKeyCount * 40}px` }}>
                    {/* White Keys */}
                    {pianoKeys.filter(k => !k.isBlack).map((key) => {
                        const isActive = activeNotes.has(key.note);
                        const intervalLabel = intervalMap.get(key.note);
                        const isCLabel = /^C\d$/.test(key.note);
                        const showPitchLabel = isActive || isCLabel;
                        const displayNote = isCLabel ? key.note : key.note.replace(/\d+$/, '');
                        return (
                            <div
                                key={key.note}
                                style={{ left: `${key.leftOffset}px`, width: '40px' }}
                                className="absolute top-0 flex flex-col items-center"
                            >
                                <button 
                                    onMouseDown={() => toggleNote(key.note)}
                                    className={`
                                        w-10 h-40 border border-gray-300 rounded-b-md flex flex-col items-center justify-end pb-1
                                        transition-colors active:bg-gray-200 z-0
                                        ${isActive ? '!bg-blue-200' : 'bg-white hover:bg-gray-50'}
                                    `}
                                >
                                    {showPitchLabel && (
                                        <span
                                            className={`text-[10px] ${isActive ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}
                                        >
                                            {displayNote}
                                        </span>
                                    )}
                                </button>
                                {isActive && intervalLabel && (
                                    <div className="mt-1 text-xs font-semibold text-blue-700 text-center">
                                        {intervalLabel}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Black Keys */}
                    {pianoKeys.filter(k => k.isBlack).map((key) => {
                        const isActive = activeNotes.has(key.note);
                        const intervalLabel = intervalMap.get(key.note);
                        const displayNote = key.note.replace(/\d+$/, '');
                        return (
                            <div
                                key={key.note}
                                style={{ left: `${key.leftOffset}px`, width: '24px' }}
                                className="absolute top-0 z-10 flex flex-col items-center"
                            >
                                <button
                                    onMouseDown={() => toggleNote(key.note)}
                                    className={`
                                        w-6 h-24 rounded-b-md border border-black flex items-end justify-center pb-1
                                        ${isActive ? 'bg-blue-800' : 'bg-black hover:bg-gray-800'}
                                    `}
                                >
                                    <span
                                        className={`text-[10px] ${isActive ? 'text-white font-semibold' : 'text-gray-300 opacity-0'}`}
                                    >
                                        {displayNote}
                                    </span>
                                </button>
                                {isActive && intervalLabel && (
                                    <div className="mt-1 text-xs font-semibold text-blue-700 text-center">
                                        {intervalLabel}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                 </div>
             </div>
        </div>
        
        {/* Interval Analysis */}
        {activeNotes.size > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Interval Analysis (Root: {root})</h3>
                <div className="flex flex-wrap gap-2">
                    {intervalAnalysis.map(({ note, interval }) => (
                        <div key={note} className="flex flex-col items-center px-3 py-2 bg-white rounded-md border border-gray-200 shadow-sm">
                            <span className="text-xs text-gray-500">{note}</span>
                            <span className="text-sm font-bold text-blue-700">{interval}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
        
      </div>
    </div>
  );
}
