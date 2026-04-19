'use client';

import { useEffect, useRef, useState } from 'react';
import { StaffRenderer } from 'music-engine';
import { Sampler } from 'sampler';

// Instantiate outside component to persist across re-renders
const sampler = new Sampler();

export default function Playground() {
  const [isLoaded, setIsLoaded] = useState(false);
  const rendererRef = useRef<StaffRenderer | null>(null);
  
  // State for active notes
  const [notes, setNotes] = useState<string[]>(["c/4", "e/4", "g/4", "b/4"]);
  const [dbVoicings, setDbVoicings] = useState<any[]>([]);
  
  const availableNotes = ["c/4", "d/4", "e/4", "f/4", "g/4", "a/4", "b/4", "c/5"];

  useEffect(() => {
    fetch('/api/voicings')
      .then(res => res.json())
      .then(data => setDbVoicings(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    // Init renderer
    const container = document.getElementById('vexflow-container');
    if (container && !rendererRef.current) {
        rendererRef.current = new StaffRenderer('vexflow-container');
    }
    
    // Render whenever notes change
    if (rendererRef.current) {
        rendererRef.current.render(notes);
    }

    // Init sampler only once
    if (!isLoaded) {
        sampler.init();
        sampler.loadPianoSamples().then(() => console.log("Piano samples loaded"));
        setIsLoaded(true);
    }
  }, [notes, isLoaded]);

  const handlePlay = () => {
    sampler.init(); 
    notes.forEach((note, index) => {
        setTimeout(() => sampler.play(note), index * 30);
    });
  };

  const toggleNote = (note: string) => {
      sampler.init();
      if (notes.includes(note)) {
          setNotes(prev => prev.filter(n => n !== note));
      } else {
          setNotes(prev => {
              const newNotes = [...prev, note];
              return newNotes.sort(); 
          });
          sampler.play(note);
      }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans flex flex-col items-center">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Voicings Playground</h1>
        <p className="mb-6 text-gray-600">Risk Assessment: VexFlow Rendering + Audio Sampler</p>
        
        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white mb-8 flex justify-center">
          <div id="vexflow-container" className="w-full flex justify-center items-center"></div>
        </div>

        <div className="flex flex-col items-center gap-6">
            {dbVoicings.length > 0 && (
              <div className="flex gap-2 mb-4">
                {dbVoicings.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      // Convert E3 to e/3 format if needed, but our seed data uses E3. 
                      // VexFlow needs e/3. Let's do a quick map.
                      const vfNotes = v.pitches.map((p: string) => {
                         const match = p.match(/([A-G][#b]?)(\d)/);
                         if (match) return `${match[1].toLowerCase()}/${match[2]}`;
                         return p;
                      });
                      setNotes(vfNotes);
                      // Auto play
                      setTimeout(() => {
                        sampler.init();
                        vfNotes.forEach((note: string, index: number) => {
                            setTimeout(() => sampler.play(note), index * 30);
                        });
                      }, 100);
                    }}
                    className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition"
                  >
                    Load {v.name} ({v.chords[0]?.chord.symbol})
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
                {availableNotes.map(note => (
                    <button
                        key={note}
                        onClick={() => toggleNote(note)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            notes.includes(note) 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {note}
                    </button>
                ))}
            </div>

            <button 
                onClick={handlePlay}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition shadow-md active:transform active:scale-95"
            >
                Play Chord
            </button>
            
            <div className="text-sm text-gray-500 mt-4 text-center">
                <p>Notes: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{notes.join(', ')}</span></p>
                <p className="mt-1">Status: <span className={isLoaded ? "text-green-600" : "text-yellow-600"}>{isLoaded ? 'Ready' : 'Initializing...'}</span></p>
                <p className="mt-2 text-xs italic">Note: Using oscillator fallback if samples are missing.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
