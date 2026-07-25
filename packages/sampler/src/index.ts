export type SampleLoadResult = {
  note: string;
  status: 'loaded' | 'failed';
};

export type SampleLoadSummary = {
  total: number;
  loaded: number;
  failed: number;
};

type AudioContextConstructor = new (contextOptions?: AudioContextOptions) => AudioContext;
type AudioWindow = Window & {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
};

const SAMPLE_BASE_URL =
  'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/acoustic_grand_piano-mp3/';
const SAMPLE_MIN_MIDI = 36;
const SAMPLE_MAX_MIDI = 84;
const SAMPLE_FILENAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SAMPLE_KEYS = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_TO_SHARP: Record<string, string> = {
  db: 'c#',
  eb: 'd#',
  gb: 'f#',
  ab: 'g#',
  bb: 'a#',
};

function normalizeNoteKey(note: string): string {
  const match = note.toLowerCase().match(/^([a-g][#b]?)\/(-?\d+)$/);
  if (!match) return note.toLowerCase();
  const pitch = FLAT_TO_SHARP[match[1]] ?? match[1];
  return `${pitch}/${match[2]}`;
}

function noteToFrequency(note: string): number {
  const normalizedNote = normalizeNoteKey(note);
  const match = normalizedNote.match(/^([a-g][#]?)[/](-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid VexFlow note: ${note}`);
  }

  const semitoneIndex = SAMPLE_KEYS.indexOf(match[1]);
  if (semitoneIndex === -1) {
    throw new Error(`Invalid VexFlow note: ${note}`);
  }

  const octave = Number.parseInt(match[2], 10);
  const midi = (octave + 1) * 12 + semitoneIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class Sampler {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private resumePromise: Promise<void> | null = null;

  init(): void {
    if (typeof window === 'undefined' || this.context) return;

    const audioWindow = window as AudioWindow;
    const ContextConstructor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!ContextConstructor) return;

    try {
      this.context = new ContextConstructor();
    } catch {
      this.context = null;
    }
  }

  async activate(): Promise<void> {
    const context = this.getContext();
    if (context.state === 'running') return;
    if (context.state === 'closed') {
      throw new Error('Audio context is closed');
    }

    if (!this.resumePromise) {
      this.resumePromise = context
        .resume()
        .then(() => {
          if (context.state !== 'running') {
            throw new Error('Audio context failed to start');
          }
        })
        .finally(() => {
          this.resumePromise = null;
        });
    }

    await this.resumePromise;
  }

  async loadSample(note: string, url: string): Promise<SampleLoadResult> {
    const context = this.getContext();

    try {
      const response = await fetch(url);
      if (!response.ok) return { note, status: 'failed' };

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      this.buffers.set(normalizeNoteKey(note), audioBuffer);
      return { note, status: 'loaded' };
    } catch {
      return { note, status: 'failed' };
    }
  }

  async loadPianoSamples(): Promise<SampleLoadSummary> {
    this.getContext();
    const requests: Promise<SampleLoadResult>[] = [];

    for (let midi = SAMPLE_MIN_MIDI; midi <= SAMPLE_MAX_MIDI; midi += 1) {
      const octave = Math.floor(midi / 12) - 1;
      const semitone = midi % 12;
      const note = `${SAMPLE_KEYS[semitone]}/${octave}`;
      const filename = `${SAMPLE_FILENAMES[semitone]}${octave}.mp3`;
      requests.push(this.loadSample(note, `${SAMPLE_BASE_URL}${filename}`));
    }

    const results = await Promise.all(requests);
    const loaded = results.filter((result) => result.status === 'loaded').length;
    return {
      total: results.length,
      loaded,
      failed: results.length - loaded,
    };
  }

  async play(note: string): Promise<void> {
    await this.activate();
    const context = this.getContext();
    const normalizedNote = normalizeNoteKey(note);
    const buffer = this.buffers.get(normalizedNote);

    if (!buffer) {
      this.playOscillator(normalizedNote, context);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
  }

  private getContext(): AudioContext {
    if (!this.context) this.init();
    if (!this.context) {
      throw new Error('Web Audio API is unavailable');
    }
    return this.context;
  }

  private playOscillator(note: string, context: AudioContext): void {
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(noteToFrequency(note), context.currentTime);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.5);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1.5);
  }
}
