import Vex from 'vexflow';
import { planGrandStaff, STAFF_HEIGHT, type StaffPlan } from './staffLayout';

const {
  Renderer,
  Stave,
  StaveNote,
  GhostNote,
  Formatter,
  StaveConnector,
  Accidental,
  Voice,
  Stem,
} = Vex.Flow;

const MIN_WIDTH = 280;
const MAX_WIDTH = 320;
const STAVE_X = 36;
const STAVE_RIGHT_PAD = 36;
/** VexFlow puts the top line this far below a stave's y. */
const STAVE_LINE_OFFSET = 40;

/** Gap between a chord and a same-line notehead pushed beside it. */
const CLASH_PAD = 3;

function buildChords(plan: StaffPlan) {
  return plan.voices.map((notes, i) => {
    const chord = new StaveNote({
      keys: notes.map((note) => note.key),
      duration: 'w',
      clef: plan.clef,
      stem_direction: i === 0 ? Stem.UP : Stem.DOWN,
    });
    notes.forEach((note, index) => {
      if (note.accidental) chord.addModifier(new Accidental(note.accidental), index);
    });
    return chord;
  });
}

const toVoice = (note: InstanceType<typeof StaveNote> | InstanceType<typeof GhostNote>) =>
  new Voice({ num_beats: 4, beat_value: 4 }).addTickables([note]);

/**
 * VexFlow's voice-collision rules skip stemless whole notes, so same-line
 * clashes are placed here: main chord in place, each extra one column to the
 * right (past any heads the main chord displaced for seconds). Accidentals
 * stay in the shared columns on the left.
 */
function placeClashes([main, ...extras]: InstanceType<typeof StaveNote>[]) {
  if (!main) return;
  main.setXShift(0);
  const column = main.getGlyphWidth() * (main.isDisplaced() ? 2 : 1) + CLASH_PAD;
  extras.forEach((chord, i) => chord.setXShift(column + i * (chord.getGlyphWidth() + CLASH_PAD)));
}

export class StaffRenderer {
  private divId: string;

  constructor(divId: string) {
    this.divId = divId;
  }

  render(notes: string[]) {
    if (typeof document === 'undefined') return;
    const div = document.getElementById(this.divId);
    if (!(div instanceof HTMLDivElement)) return;
    div.innerHTML = '';

    const plan = planGrandStaff(notes);
    const width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, div.clientWidth || 300));
    const staveWidth = width - STAVE_X - STAVE_RIGHT_PAD;
    const trebleTop = plan.top;
    const bassTop = trebleTop + STAFF_HEIGHT + plan.gap;
    const height = bassTop + STAFF_HEIGHT + plan.bottom;

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();

    const staveTreble = new Stave(STAVE_X, trebleTop - STAVE_LINE_OFFSET, staveWidth).addClef(
      'treble',
    );
    const staveBass = new Stave(STAVE_X, bassTop - STAVE_LINE_OFFSET, staveWidth).addClef('bass');
    staveTreble.setContext(context).draw();
    staveBass.setContext(context).draw();

    for (const type of [
      StaveConnector.type.BRACE,
      StaveConnector.type.SINGLE_LEFT,
      StaveConnector.type.SINGLE_RIGHT,
    ]) {
      new StaveConnector(staveTreble, staveBass).setType(type).setContext(context).draw();
    }

    try {
      const trebleChords = buildChords(plan.treble);
      const bassChords = buildChords(plan.bass);
      const trebleVoices = trebleChords.length
        ? trebleChords.map(toVoice)
        : [toVoice(new GhostNote({ duration: 'w' }))];
      const bassVoices = bassChords.length
        ? bassChords.map(toVoice)
        : [toVoice(new GhostNote({ duration: 'w' }))];

      // One formatter for both staves keeps the chords in a single column.
      const formatter = new Formatter().joinVoices(trebleVoices).joinVoices(bassVoices);
      formatter.formatToStave([...trebleVoices, ...bassVoices], staveTreble);
      placeClashes(trebleChords);
      placeClashes(bassChords);
      trebleVoices.forEach((voice) => voice.draw(context, staveTreble));
      bassVoices.forEach((voice) => voice.draw(context, staveBass));
    } catch (e) {
      console.error('VexFlow render error:', e);
    }

    const svg = div.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.display = 'block';
    }
  }
}
