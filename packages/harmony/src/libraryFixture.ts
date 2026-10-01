import { analyzeVoicing } from './voicing';
import type { LibraryVoicing } from './finder';
import { pitchToMidi } from './pitch';

/** Test helper: a small library of textbook ii–V–I voicings, built through analyzeVoicing. */
export function fixtureLibrary(): LibraryVoicing[] {
  const rows: [string, string, string[]][] = [
    ['dm9-a', 'F3 A3 C4 E4', ['Dm9/F']],
    ['dm9-b', 'C4 E4 F4 A4', ['Dm9/C']],
    ['g13-a', 'B3 E4 F4 A4', ['G13/B']],
    ['g13-b', 'F3 A3 B3 E4', ['G13/F']],
    ['cmaj9-a', 'E3 G3 B3 D4', ['Cmaj9/E', 'Em7']],
    ['cmaj9-b', 'B3 D4 E4 G4', ['Cmaj9/B']],
    ['dm7b5', 'D3 Ab3 C4 F4', ['Dm7b5']],
    ['g7alt', 'F3 B3 Eb4 Ab4', ['G7(b9,b13)/F']],
    ['cm6', 'Eb3 A3 C4 G4', ['Cm6/Eb']],
  ];
  return rows.map(([id, pitches, symbols]) => {
    const { shape, structure, readings } = analyzeVoicing(
      pitches.split(' ').map(pitchToMidi),
      symbols,
    );
    return {
      id,
      name: id,
      intervals: shape.intervals,
      bassMidi: shape.bassMidi,
      structure,
      readings,
    };
  });
}
