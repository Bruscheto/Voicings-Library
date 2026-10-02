import { describe, expect, it } from 'vitest';
import {
  findShape,
  findVoicings,
  nearestBass,
  queryFromNotes,
  queryFromSymbol,
  querySymbol,
} from './finder';
import { fixtureLibrary } from './libraryFixture';
import { midiToPitch } from './pitch';
import { notes } from './testNotes';
import { analyzeVoicing } from './voicing';

const library = fixtureLibrary();
const find = (symbol: string) => findVoicings(library, queryFromSymbol(symbol));
const pitches = (midi: number[]) => midi.map(midiToPitch).join(' ');

describe('findVoicings', () => {
  it('finds a shape authored in one key in any other key', () => {
    const results = find('Bb13');
    expect(results.map((r) => r.voicing.id).sort()).toEqual(['g13-a', 'g13-b']);
    const a = results.find((r) => r.voicing.id === 'g13-a')!;
    expect(a).toMatchObject({ symbol: 'Bb13/D', match: 'exact' });
    expect(pitches(a.midi)).toBe('D4 G4 Ab4 C5');
  });

  it('offers richer voicings for a plain chart symbol, exact ones first', () => {
    const results = find('Em7');
    expect(results[0]).toMatchObject({ voicing: { id: 'cmaj9-a' }, match: 'exact' });
    // The Em7 shape moved to D is an exact Dm7; the Dm9 shapes add a 9th.
    expect(find('Dm7').map((r) => [r.voicing.id, r.match])).toEqual([
      ['cmaj9-a', 'exact'],
      ['dm9-a', 'extended'],
      ['dm9-b', 'extended'],
    ]);
  });

  it('removes primary-reading tags when an alternate reading contains the root', () => {
    const result = find('Em7')[0];
    expect(result.voicing.structure).toContain('rootless-a');
    expect(result.voicing.structure).toContain('ust');
    expect(result.structure).toEqual(['close']);
    expect(find('Cmaj9')[0].structure).toEqual(['rootless-a', 'ust', 'close']);
  });

  it.each(Array.from({ length: 12 }, (_, rootPc) => rootPc))(
    'switches rootless A to B for an alternate dominant reading on root %i',
    (rootPc) => {
      const { shape, structure, readings } = analyzeVoicing(notes('B3 E4 F4 A4'), [
        'G13/B',
        'Db7(#9,b13)/B',
      ]);
      const voicing = { id: 'dominant', name: null, ...shape, structure, readings };
      const [result] = findVoicings([voicing], {
        ...queryFromSymbol('Db7(#9,b13)'),
        rootPc,
      });
      expect(result.structure).toEqual(['rootless-b', 'close']);
      expect(result.voicing).toBe(voicing);
      expect(voicing.structure).toEqual(['rootless-a', 'close']);
      expect(findVoicings([voicing], queryFromSymbol('G13'))[0].structure).toEqual([
        'rootless-a',
        'close',
      ]);
    },
  );

  it('respects a slash bass', () => {
    expect(find('Dm9/F').map((r) => r.voicing.id)).toEqual(['dm9-a']);
    expect(find('Dm9/C').map((r) => r.voicing.id)).toEqual(['dm9-b']);
  });

  it('matches 7alt only to altered dominants', () => {
    expect(find('C7alt').map((r) => r.voicing.id)).toEqual(['g7alt']);
    expect(find('C7alt')[0].symbol).toBe('C7(b9,b13)/Bb');
  });

  it('finds nothing for chords the library lacks', () => {
    expect(find('C7#11')).toEqual([]);
  });
});

describe('queries', () => {
  it('reads played notes ignoring the bass', () => {
    expect(queryFromNotes(notes('A2 C#3 F#3 B3'))).toMatchObject({ bassPc: null });
    expect(queryFromNotes(notes('C4'))).toBeNull();
  });

  it('spells queries back', () => {
    expect(querySymbol(queryFromSymbol('G7alt'))).toBe('G7alt');
    expect(querySymbol(queryFromSymbol('Dm9/F'))).toBe('Dmin9/F');
  });

  it('keeps a transposed bass within a tritone', () => {
    expect(nearestBass(59, 2)).toBe(62);
    expect(nearestBass(59, 6)).toBe(54);
  });

  it('finds an exact shape in any key', () => {
    expect(findShape(library, notes('E3 A3 Bb3 D4'))?.id).toBe('g13-a');
    expect(findShape(library, notes('C3 D3 E3'))).toBeNull();
    expect(findShape(library, notes('C3'))).toBeNull();
  });
});
