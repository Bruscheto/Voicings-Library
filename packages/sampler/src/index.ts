export class Sampler {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();

  constructor() {}

  init() {
    if (typeof window !== 'undefined' && !this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async loadSample(note: string, url: string) {
    if (!this.context) this.init();
    if (!this.context) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers.set(note, audioBuffer);
    } catch (e) {
      console.error(`Failed to load sample for ${note}`, e);
    }
  }

  async loadPianoSamples() {
    if (!this.context) this.init();
    
    const baseUrl = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/acoustic_grand_piano-mp3/';
    // Map for filenames (CDN uses flats)
    const filenames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    // Map for internal keys (We use sharps to match AdminPage)
    const keys = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    
    // Load range C2 (36) to C6 (84)
    const promises = [];
    for (let i = 36; i <= 84; i++) {
        const octave = Math.floor(i / 12) - 1;
        const semitone = i % 12;
        
        const filenameNote = filenames[semitone];
        const keyNote = keys[semitone];
        
        // VexFlow format: c/4, c#/4
        const vfNote = `${keyNote}/${octave}`;
        
        // CDN format: Db4.mp3
        const filename = `${filenameNote}${octave}.mp3`;
        
        promises.push(this.loadSample(vfNote, `${baseUrl}${filename}`));
    }
    
    await Promise.all(promises);
    console.log('Samples loaded');
  }

  play(note: string) {
    if (!this.context) this.init();
    if (!this.context) return;
    
    // Resume context if suspended (browser policy)
    if (this.context.state === 'suspended') {
        this.context.resume();
    }

    const buffer = this.buffers.get(note);
    if (!buffer) {
      console.warn(`No sample found for ${note}, using fallback oscillator`);
      this.playOscillator(note);
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start();
  }

  playOscillator(note: string) {
      if (!this.context) return;
      const osc = this.context.createOscillator();
      osc.type = 'triangle'; // Triangle sounds a bit closer to a piano than sine
      
      // Parse VexFlow note (e.g. "c/4", "c#/4", "db/4")
      // VexFlow uses lower case and / for octave
      const match = note.match(/([a-g][#b]?)?\/(\d)/);
      if (!match) return;
      
      const noteName = match[1];
      const octave = parseInt(match[2]);
      
      const notes = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
      // Handle flats
      const normalizedNote = noteName.replace('db', 'c#').replace('eb', 'd#').replace('gb', 'f#').replace('ab', 'g#').replace('bb', 'a#');
      
      const semitoneIndex = notes.indexOf(normalizedNote);
      if (semitoneIndex === -1) return;
      
      // MIDI note calculation: C4 = 60
      // C0 is 12.
      // octave * 12 + semitoneIndex + 12 = MIDI
      const midi = (octave + 1) * 12 + semitoneIndex;
      
      // Frequency formula: f = 440 * 2^((d - 69) / 12)
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      
      osc.frequency.setValueAtTime(freq, this.context.currentTime); 
      
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.3, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.5);
      
      osc.connect(gain);
      gain.connect(this.context.destination);
      
      osc.start();
      osc.stop(this.context.currentTime + 1.5);
  }
}
