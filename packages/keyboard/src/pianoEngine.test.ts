import { describe, expect, it, vi } from 'vitest';
import { PianoEngine, type PianoDeps, type PianoStatus } from './pianoEngine';

const NOW = 10;

function setup({ failures = 0, total = 29, rejectLoad = false } = {}) {
  let finishLoading!: () => void;
  let failLoading!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    finishLoading = resolve;
    failLoading = reject;
  });
  const piano = {
    ready,
    start: vi.fn(),
    stop: vi.fn(),
    loadProgress: { loaded: total, total },
  };
  const context = {
    state: 'suspended',
    currentTime: NOW,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    createDynamicsCompressor: vi.fn(() => ({ connect: vi.fn() })),
  };
  const deps: PianoDeps = {
    createContext: vi.fn(() => context as unknown as AudioContext),
    createStorage: vi.fn(() => ({ fetch: vi.fn(), failures })),
    createPiano: vi.fn(() => piano as never),
  };
  const engine = new PianoEngine(deps);
  const statuses: PianoStatus[] = [];
  engine.subscribe((s) => statuses.push(s));
  const loaded = async () => {
    if (rejectLoad) failLoading(new Error('decode failed'));
    else finishLoading();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { engine, deps, piano, context, statuses, loaded };
}

const startTimes = (start: ReturnType<typeof vi.fn>) =>
  start.mock.calls.map(([event]) => (event as { time: number }).time);

describe('PianoEngine', () => {
  it('builds the audio graph and loads samples once', async () => {
    const { engine, deps, context, loaded } = setup();
    engine.load();
    engine.load();
    const playing = engine.playChord([60]);
    await loaded();
    await playing;
    expect(deps.createContext).toHaveBeenCalledTimes(1);
    expect(deps.createPiano).toHaveBeenCalledTimes(1);
    expect(context.createDynamicsCompressor).toHaveBeenCalledTimes(1);
  });

  it('reports ready, partial or unavailable from what loaded', async () => {
    const full = setup();
    full.engine.load();
    await full.loaded();
    expect(full.statuses).toEqual(['loading', 'ready']);

    const some = setup({ failures: 3 });
    some.engine.load();
    await some.loaded();
    expect(some.statuses.at(-1)).toBe('partial');

    const none = setup({ failures: 29 });
    none.engine.load();
    await none.loaded();
    expect(none.statuses.at(-1)).toBe('unavailable');

    const broken = setup({ rejectLoad: true });
    broken.engine.load();
    await broken.loaded();
    expect(broken.statuses.at(-1)).toBe('unavailable');
  });

  it('starts every note of a chord at the same time, after resuming the context', async () => {
    const { engine, piano, context, loaded } = setup();
    const playing = engine.playChord([48, 52, 55, 59]);
    await loaded();
    await playing;
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(new Set(startTimes(piano.start))).toEqual(new Set([NOW + 0.03]));
    expect(piano.start).toHaveBeenCalledWith(expect.objectContaining({ note: 48, duration: 2.5 }));
  });

  it('spaces arpeggio notes evenly', async () => {
    const { engine, piano, loaded } = setup();
    const playing = engine.playChord([48, 52, 55], true);
    await loaded();
    await playing;
    const [a, b, c] = startTimes(piano.start);
    expect(b - a).toBeCloseTo(0.1);
    expect(c - b).toBeCloseTo(0.1);
  });

  it('schedules a sequence on the audio clock, one chord per step', async () => {
    const { engine, piano, loaded } = setup();
    const playing = engine.playSequence(
      [
        [50, 53],
        [55, 59],
      ],
      1.5,
    );
    await loaded();
    await playing;
    expect(startTimes(piano.start)).toEqual([NOW + 0.03, NOW + 0.03, NOW + 1.53, NOW + 1.53]);
    expect(piano.start).toHaveBeenCalledWith(expect.objectContaining({ duration: 1.5 }));
  });

  it('releases sounding notes when a new chord plays, and drops a superseded one', async () => {
    const { engine, piano, loaded } = setup();
    const first = engine.playChord([60, 64]);
    const second = engine.playChord([62, 65]);
    await loaded();
    await Promise.all([first, second]);
    // Nothing was sounding before the first chord, so only the second releases voices.
    expect(piano.stop).toHaveBeenCalledTimes(1);
    expect(piano.start.mock.calls.map(([e]) => (e as { note: number }).note)).toEqual([62, 65]);
  });

  it('lets single keys ring together', async () => {
    const { engine, piano, loaded } = setup();
    const playing = Promise.all([engine.playKey(60), engine.playKey(64)]);
    await loaded();
    await playing;
    expect(piano.stop).not.toHaveBeenCalled();
    expect(piano.start).toHaveBeenCalledTimes(2);
  });

  it('stop() cancels a chord still waiting for samples', async () => {
    const { engine, piano, loaded } = setup();
    const playing = engine.playChord([60]);
    engine.stop();
    await loaded();
    await playing;
    expect(piano.start).not.toHaveBeenCalled();
  });

  it('stays silent and unavailable when audio cannot start', async () => {
    const deps: PianoDeps = {
      createContext: () => {
        throw new Error('no Web Audio');
      },
      createStorage: vi.fn(),
      createPiano: vi.fn(),
    };
    const engine = new PianoEngine(deps);
    const statuses: PianoStatus[] = [];
    engine.subscribe((s) => statuses.push(s));
    await engine.playChord([60]);
    await engine.playKey(60);
    engine.load();
    expect(statuses).toEqual(['loading', 'unavailable']);
    expect(deps.createPiano).not.toHaveBeenCalled();
  });

  it('does not play after loading failed', async () => {
    const { engine, piano, loaded } = setup({ rejectLoad: true });
    const playing = engine.playChord([60]);
    await loaded();
    await playing;
    expect(piano.start).not.toHaveBeenCalled();
  });
});
