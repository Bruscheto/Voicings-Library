/**
 * Voicing records: the one path from played notes (and optional authored
 * symbols) to what is stored, and from a stored row back to what is shown.
 * The capture API and the CSV importer both write through analyzeVoicing, so
 * nothing reaches the database that the engine cannot read.
 */

import {
  buildSymbol,
  classifyStructure,
  detectChord,
  midiToPitch,
  mod12,
  normalizeNotes,
  parseSymbol,
  pcName,
  readAs,
  toShape,
  type BaseQuality,
  type Reading,
  type Shape,
  type Structure,
} from 'harmony';

export type ReadingRecord = {
  rootOffset: number;
  quality: BaseQuality;
  tensions: string[];
  rootless: boolean;
  isPrimary: boolean;
};

export type VoicingAnalysis = {
  shape: Shape;
  structure: Structure[];
  readings: ReadingRecord[];
};

export class VoicingAnalysisError extends Error {}

const LOWEST_MIDI = 21;
const HIGHEST_MIDI = 108;
const ALTERED_TENSIONS = new Set(['b9', '#9', '#11', 'b13']);

/**
 * Validate notes and authored symbols against the engine. With no symbols the
 * engine's top reading becomes the primary one; otherwise the first symbol is
 * primary and every symbol must be supported by the notes exactly.
 */
export function analyzeVoicing(
  midi: readonly number[],
  symbols: readonly string[] = [],
): VoicingAnalysis {
  const notes = normalizeNotes(midi);
  const outOfRange = notes.filter(
    (n) => !Number.isInteger(n) || n < LOWEST_MIDI || n > HIGHEST_MIDI,
  );
  if (outOfRange.length)
    throw new VoicingAnalysisError(`notes outside the piano: ${outOfRange.join(', ')}`);
  if (new Set(notes.map(mod12)).size < 2)
    throw new VoicingAnalysisError('a voicing needs at least two pitch classes');

  const readings = symbols.length
    ? symbols.map((symbol) => authoredReading(notes, symbol))
    : [detectedReading(notes)];
  const unique = readings.filter(
    (r, i) => readings.findIndex((o) => o.rootPc === r.rootPc && o.quality === r.quality) === i,
  );
  const bassPc = mod12(notes[0]);
  const primary = unique[0];
  return {
    shape: toShape(notes),
    structure: classifyStructure(notes, primary),
    readings: unique.map((r, i) => ({
      rootOffset: mod12(r.rootPc - bassPc),
      quality: r.quality,
      tensions: r.tensions,
      rootless: r.rootless,
      isPrimary: i === 0,
    })),
  };
}

function detectedReading(notes: number[]): Reading {
  const [top] = detectChord(notes).readings;
  if (!top)
    throw new VoicingAnalysisError(`no chord reading for ${notes.map(midiToPitch).join(' ')}`);
  return top;
}

function authoredReading(notes: number[], symbol: string): Reading {
  let parsed;
  try {
    parsed = parseSymbol(symbol);
  } catch (error) {
    throw new VoicingAnalysisError(error instanceof Error ? error.message : String(error));
  }
  const bassPc = mod12(notes[0]);
  if (parsed.bassPc !== null && parsed.bassPc !== bassPc) {
    throw new VoicingAnalysisError(
      `${symbol}: slash bass is ${pcName(parsed.bassPc)} but the lowest note is ${pcName(bassPc)}`,
    );
  }
  const reading = readAs(notes, parsed.rootPc, parsed.quality);
  if (!reading)
    throw new VoicingAnalysisError(
      `${symbol}: the notes ${notes.map(midiToPitch).join(' ')} do not spell this chord${suggestion(notes)}`,
    );
  if (parsed.altered) {
    if (!reading.tensions.length || !reading.tensions.every((t) => ALTERED_TENSIONS.has(t))) {
      throw new VoicingAnalysisError(
        `${symbol}: an altered dominant needs only altered tensions, found [${reading.tensions.join(', ')}]`,
      );
    }
    return reading;
  }
  if (reading.tensions.join(',') !== parsed.tensions.join(',')) {
    const heard = buildSymbol(reading.root, reading.quality, reading.tensions, null);
    throw new VoicingAnalysisError(
      `${symbol}: the notes spell ${heard} (tensions [${reading.tensions.join(', ')}])`,
    );
  }
  return reading;
}

function suggestion(notes: number[]): string {
  const [top] = detectChord(notes).readings;
  return top ? `; they read as ${top.symbol}` : '';
}

export type StoredReading = {
  rootOffset: number;
  quality: string;
  tensions: string[];
  rootless: boolean;
  isPrimary: boolean;
};

export type StoredVoicing = {
  intervals: number[];
  bassMidi: number;
  readings: StoredReading[];
};

export type ReadingView = {
  root: string;
  quality: string;
  tensions: string[];
  rootless: boolean;
  isPrimary: boolean;
  /** Bass note name when it differs from the root, else null. */
  slashBass: string | null;
  symbol: string;
};

/** Notes and readings of a stored shape, at its authored bass or a new one. */
export function realizeVoicing(voicing: StoredVoicing, bassMidi = voicing.bassMidi) {
  const midi = voicing.intervals.map((i) => bassMidi + i);
  const bassPc = mod12(bassMidi);
  const readings: ReadingView[] = [...voicing.readings]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((r) => {
      const root = pcName(bassPc + r.rootOffset);
      const slashBass = r.rootOffset === 0 ? null : pcName(bassPc);
      return {
        root,
        quality: r.quality,
        tensions: r.tensions,
        rootless: r.rootless,
        isPrimary: r.isPrimary,
        slashBass,
        symbol: buildSymbol(root, r.quality, r.tensions, slashBass),
      };
    });
  return { midi, pitches: midi.map(midiToPitch), readings, primary: readings[0] ?? null };
}
