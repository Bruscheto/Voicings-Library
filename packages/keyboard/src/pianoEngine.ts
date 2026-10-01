/**
 * One piano for the whole app. The AudioContext and the Splendid Grand Piano
 * samples are created on first use and shared by every component, so moving
 * between pages never reloads them. Notes are scheduled on the audio clock:
 * a chord's notes share one start time, and a new chord or stop() releases
 * whatever is still sounding.
 */

import { SplendidGrandPiano, type Smplr } from 'smplr';
import { PIANO_SAMPLE_NOTES, PIANO_VELOCITY, PIANO_VELOCITY_RANGE } from './pianoSamples';
import { createPianoStorage, type PianoStorage } from './pianoStorage';

export type PianoStatus = 'loading' | 'ready' | 'partial' | 'unavailable';

type Piano = Pick<Smplr, 'ready' | 'start' | 'stop' | 'loadProgress'>;
type Audio = { context: AudioContext; piano: Piano };

export type PianoDeps = {
  createContext: () => AudioContext;
  createStorage: () => PianoStorage;
  createPiano: (context: AudioContext, destination: AudioNode, storage: PianoStorage) => Piano;
};

// Scheduling slightly ahead lets every note of a chord start on the same sample.
const LOOKAHEAD_S = 0.03;
const ARPEGGIO_STEP_S = 0.1;
const CHORD_DURATION_S = 2.5;
const KEY_DURATION_S = 1.5;
const RELEASE_S = 0.6;

export class PianoEngine {
  private status: PianoStatus = 'loading';
  private readonly listeners = new Set<(status: PianoStatus) => void>();
  private audio: Audio | null = null;
  private generation = 0;

  constructor(private readonly deps: PianoDeps) {}

  /** Create the audio graph and start fetching samples; later calls do nothing. */
  load(): void {
    if (this.audio || this.status === 'unavailable') return;
    try {
      const context = this.deps.createContext();
      // Dense voicings sum past full scale; the compressor keeps them clean.
      const compressor = context.createDynamicsCompressor();
      compressor.connect(context.destination);
      const storage = this.deps.createStorage();
      const piano = this.deps.createPiano(context, compressor, storage);
      this.audio = { context, piano };
      piano.ready.then(
        () => this.setStatus(loadedStatus(storage.failures, piano.loadProgress.total)),
        () => this.setStatus('unavailable'),
      );
    } catch {
      this.setStatus('unavailable');
    }
  }

  subscribe(listener: (status: PianoStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  /** A chord, together or as an arpeggio; replaces anything still sounding. */
  async playChord(midi: readonly number[], arpeggio = false): Promise<void> {
    const audio = await this.claim();
    if (!audio) return;
    const start = audio.context.currentTime + LOOKAHEAD_S;
    midi.forEach((note, i) =>
      this.start(audio, note, arpeggio ? start + i * ARPEGGIO_STEP_S : start, CHORD_DURATION_S),
    );
  }

  /** Chords one after another, `stepS` seconds apart; replaces anything still sounding. */
  async playSequence(chords: readonly (readonly number[])[], stepS: number): Promise<void> {
    const audio = await this.claim();
    if (!audio) return;
    const start = audio.context.currentTime + LOOKAHEAD_S;
    chords.forEach((chord, i) =>
      chord.forEach((note) => this.start(audio, note, start + i * stepS, stepS)),
    );
  }

  /** One key, as from a click or MIDI; other sounding notes keep ringing. */
  async playKey(midi: number): Promise<void> {
    const audio = await this.ready();
    if (!audio) return;
    this.start(audio, midi, audio.context.currentTime, KEY_DURATION_S);
  }

  stop(): void {
    this.generation++;
    this.audio?.piano.stop();
  }

  private setStatus(status: PianoStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }

  /** Stop what is sounding and wait until playable; null if a later call took over. */
  private async claim(): Promise<Audio | null> {
    this.stop();
    const run = this.generation;
    const audio = await this.ready();
    return audio && run === this.generation ? audio : null;
  }

  private async ready(): Promise<Audio | null> {
    this.load();
    if (!this.audio) return null;
    const { context, piano } = this.audio;
    try {
      // resume() must start inside the user gesture, before any await.
      if (context.state === 'suspended') await context.resume();
      await piano.ready;
    } catch {
      return null;
    }
    return this.status === 'unavailable' ? null : this.audio;
  }

  private start(audio: Audio, note: number, time: number, duration: number): void {
    audio.piano.start({ note, time, duration, velocity: PIANO_VELOCITY });
  }
}

function loadedStatus(failures: number, total: number): PianoStatus {
  if (failures === 0) return 'ready';
  return failures >= total ? 'unavailable' : 'partial';
}

// Next.js inlines this at build time; unset, smplr's own sample host is used.
const SAMPLES_URL = process.env.NEXT_PUBLIC_PIANO_SAMPLES_URL;

export const browserDeps: PianoDeps = {
  createContext: () => {
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Context = window.AudioContext ?? audioWindow.webkitAudioContext;
    return new Context();
  },
  createStorage: () => createPianoStorage(),
  createPiano: (context, destination, storage) =>
    SplendidGrandPiano(context, {
      destination,
      storage,
      decayTime: RELEASE_S,
      velocity: PIANO_VELOCITY,
      ...(SAMPLES_URL ? { baseUrl: SAMPLES_URL } : {}),
      notesToLoad: {
        notes: PIANO_SAMPLE_NOTES,
        velocityRange: PIANO_VELOCITY_RANGE,
        fallback: 'nearest',
      },
    }),
};
