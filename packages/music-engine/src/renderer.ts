import Vex from 'vexflow';

export class StaffRenderer {
  private divId: string;

  constructor(divId: string) {
    this.divId = divId;
  }

  render(notes: string[]) {
    if (typeof document === 'undefined') return;
    const div = document.getElementById(this.divId);
    if (!div) return;
    div.innerHTML = ''; // Clear previous

    const { Renderer, Stave, StaveNote, Formatter, StaveConnector, Accidental, Voice } = Vex.Flow;

    // Detect extreme range to add padding above/below the grand staff.
    // Treble staff comfortably shows octaves 4-5; bass shows 2-3.
    // Each octave outside that needs ~60px of ledger-line space.
    const PIXELS_PER_EXTRA_OCTAVE = 60;
    const TREBLE_NORMAL_TOP_OCT = 5;
    const BASS_NORMAL_BOTTOM_OCT = 2;

    const octaves = notes
      .map(n => parseInt(n.split('/')[1]))
      .filter(n => Number.isFinite(n));
    const maxOct = octaves.length ? Math.max(...octaves) : TREBLE_NORMAL_TOP_OCT;
    const minOct = octaves.length ? Math.min(...octaves) : BASS_NORMAL_BOTTOM_OCT;

    const extraTop = Math.max(0, maxOct - TREBLE_NORMAL_TOP_OCT) * PIXELS_PER_EXTRA_OCTAVE;
    const extraBottom = Math.max(0, BASS_NORMAL_BOTTOM_OCT - minOct) * PIXELS_PER_EXTRA_OCTAVE;

    const trebleY = 40 + extraTop;
    const bassY = trebleY + 120;
    const canvasHeight = bassY + 120 + extraBottom;

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, canvasHeight);
    const context = renderer.getContext();

    // 1. Create Staves (Treble + Bass)
    // Shifted x to 50 to prevent cut-off
    const staveTreble = new Stave(50, trebleY, 400);
    const staveBass = new Stave(50, bassY, 400);

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
        new Formatter().joinVoices([voiceTreble]).format([voiceTreble], 350);
        voiceTreble.draw(context, staveTreble);

        new Formatter().joinVoices([voiceBass]).format([voiceBass], 350);
        voiceBass.draw(context, staveBass);
        
    } catch (e) {
        console.error("VexFlow render error:", e);
    }
  }
}
