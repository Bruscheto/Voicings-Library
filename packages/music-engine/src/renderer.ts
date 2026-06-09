import Vex from 'vexflow';

export class StaffRenderer {
  private divId: string;

  constructor(divId: string) {
    this.divId = divId;
  }

  render(notes: string[]) {
    if (typeof document === 'undefined') return;
    const div = document.getElementById(this.divId);
    if (!(div instanceof HTMLDivElement)) return;
    div.innerHTML = ''; // Clear previous

    const { Renderer, Stave, StaveNote, Formatter, StaveConnector, Accidental, Voice } = Vex.Flow;

    // Detect extreme range to add ledger-line padding above/below the grand
    // staff. An SVG element clips its own overflow, so the canvas must be tall
    // enough to contain every note head plus its ledger lines, or the lowest
    // notes get cut off. Measure the actual pitch extent in semitones rather
    // than bucketing by octave (which left octave-2 notes below G2 clipped).
    const NOTE_TO_PC: Record<string, number> = {
      c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5,
      'f#': 6, gb: 6, g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
    };
    const toMidi = (n: string): number | null => {
      const [name, octStr] = n.split('/');
      const pc = NOTE_TO_PC[name?.toLowerCase()];
      const oct = parseInt(octStr);
      if (pc === undefined || !Number.isFinite(oct)) return null;
      return (oct + 1) * 12 + pc;
    };

    const PX_PER_SEMITONE = 3.2;
    const TREBLE_TOP_COMFORT = 81; // A5 — highest pitch needing no extra top space
    const BASS_BOTTOM_COMFORT = 43; // G2 — bass staff bottom line

    const midis = notes
      .map(toMidi)
      .filter((m): m is number => m !== null);
    const highestMidi = midis.length ? Math.max(...midis) : 71; // B4
    const lowestMidi = midis.length ? Math.min(...midis) : 50; // D3

    const extraTop = Math.max(0, highestMidi - TREBLE_TOP_COMFORT) * PX_PER_SEMITONE;
    const extraBottom = Math.max(0, BASS_BOTTOM_COMFORT - lowestMidi) * PX_PER_SEMITONE;

    const width = Math.max(280, Math.min(320, div.clientWidth || 300));
    const staveWidth = width - 72;
    const trebleY = 16 + extraTop;
    const bassY = trebleY + 60;
    const canvasHeight = bassY + 70 + extraBottom;

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(width, canvasHeight);
    const context = renderer.getContext();

    // 1. Create Staves (Treble + Bass)
    const staveTreble = new Stave(36, trebleY, staveWidth);
    const staveBass = new Stave(36, bassY, staveWidth);

    staveTreble.addClef("treble");
    staveBass.addClef("bass");

    // 2. Connect them (Grand Staff Brace)
    const connector = new StaveConnector(staveTreble, staveBass);
    connector.setType(StaveConnector.type.BRACE);
    connector.setContext(context).draw();

    const lineLeft = new StaveConnector(staveTreble, staveBass);
    lineLeft.setType(StaveConnector.type.SINGLE_LEFT);
    lineLeft.setContext(context).draw();
    
    const lineRight = new StaveConnector(staveTreble, staveBass);
    lineRight.setType(StaveConnector.type.SINGLE_RIGHT);
    lineRight.setContext(context).draw();

    staveTreble.setContext(context).draw();
    staveBass.setContext(context).draw();

    // 3. Split notes between staves
    // Simple logic: < C4 goes to Bass, >= C4 goes to Treble
    const trebleKeys: string[] = [];
    const bassKeys: string[] = [];

    notes.forEach(note => {
        // Parse "c/4" -> key: "c", octave: 4
        const parts = note.split('/');
        if (parts.length === 2) {
            const octave = parseInt(parts[1]);
            if (octave < 4) {
                bassKeys.push(note);
            } else {
                trebleKeys.push(note);
            }
        }
    });

    try {
        // Treble Voice
        const voiceTreble = new Voice({ num_beats: 4, beat_value: 4 });
        if (trebleKeys.length > 0) {
            const note = new StaveNote({ keys: trebleKeys, duration: "w", clef: "treble" });
            voiceTreble.addTickables([note]);
            Accidental.applyAccidentals([voiceTreble], "C");
        } else {
            const note = new StaveNote({ keys: ["b/4"], duration: "w", clef: "treble" })
                .setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
            voiceTreble.addTickables([note]);
        }

        // Bass Voice
        const voiceBass = new Voice({ num_beats: 4, beat_value: 4 });
        if (bassKeys.length > 0) {
            const note = new StaveNote({ keys: bassKeys, duration: "w", clef: "bass" });
            voiceBass.addTickables([note]);
            Accidental.applyAccidentals([voiceBass], "C");
        } else {
            const note = new StaveNote({ keys: ["d/3"], duration: "w", clef: "bass" })
                .setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
            voiceBass.addTickables([note]);
        }

        // Format and draw
        new Formatter().joinVoices([voiceTreble]).format([voiceTreble], staveWidth - 50);
        voiceTreble.draw(context, staveTreble);

        new Formatter().joinVoices([voiceBass]).format([voiceBass], staveWidth - 50);
        voiceBass.draw(context, staveBass);
        const svg = div.querySelector('svg') as SVGSVGElement | null;
        if (svg) {
            // VexFlow draws at absolute coordinates that can extend past the
            // initial canvas (e.g. ledger lines on low bass notes), and an SVG
            // viewport clips its own overflow. Measure the actual drawn content
            // and size a viewBox to contain all of it, so nothing is cut off.
            let viewW = width;
            let viewH = canvasHeight;
            try {
                const bbox = svg.getBBox();
                const pad = 10;
                viewW = Math.max(width, Math.ceil(bbox.x + bbox.width + pad));
                viewH = Math.ceil(bbox.y + bbox.height + pad);
            } catch {
                // getBBox can throw if the SVG is not yet laid out; fall back to
                // the estimated canvas size.
            }
            svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.removeAttribute('height');
            svg.setAttribute('width', `${viewW}`);
            svg.style.width = '100%';
            svg.style.height = 'auto';
            svg.style.display = 'block';
        }

    } catch (e) {
        console.error("VexFlow render error:", e);
    }
  }
}
