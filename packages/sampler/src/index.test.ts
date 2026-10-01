import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sampler } from './index';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createAudioContext({
  initialState = 'suspended',
  resumeSetsRunning = true,
}: {
  initialState?: AudioContextState;
  resumeSetsRunning?: boolean;
} = {}) {
  const resumeGate = createDeferred<void>();
  let state = initialState;
  const bufferSources: Array<{
    buffer: AudioBuffer | null;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }> = [];
  const oscillators: Array<{
    type: OscillatorType;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const decodedBuffer = { id: 'decoded-buffer' } as unknown as AudioBuffer;

  const context = {
    currentTime: 0,
    destination: { id: 'destination' },
    get state() {
      return state;
    },
    resume: vi.fn(async () => {
      await resumeGate.promise;
      if (resumeSetsRunning) state = 'running';
    }),
    decodeAudioData: vi.fn(async () => decodedBuffer),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as AudioBuffer | null,
        connect: vi.fn(),
        start: vi.fn(),
      };
      bufferSources.push(source);
      return source;
    }),
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    }),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
  };

  return {
    bufferSources,
    context,
    decodedBuffer,
    oscillators,
    resumeGate,
  };
}

function installAudioContext(context: object) {
  const AudioContextConstructor = vi.fn(function AudioContextConstructor() {
    return context;
  });
  vi.stubGlobal('window', { AudioContext: AudioContextConstructor });
  return AudioContextConstructor;
}

function installSuccessfulFetch() {
  const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
  const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer }));
  vi.stubGlobal('fetch', fetchMock);
  return { arrayBuffer, fetchMock };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Sampler audio activation', () => {
  it('waits for a suspended context to resume before starting a loaded sample', async () => {
    const fake = createAudioContext();
    installAudioContext(fake.context);
    installSuccessfulFetch();
    const sampler = new Sampler();
    await sampler.loadSample('c/4', '/C4.mp3');

    const playback = sampler.play('c/4');

    expect(fake.context.resume).toHaveBeenCalledTimes(1);
    expect(fake.context.createBufferSource).not.toHaveBeenCalled();

    fake.resumeGate.resolve();
    await playback;

    expect(fake.bufferSources[0].buffer).toBe(fake.decodedBuffer);
    expect(fake.bufferSources[0].start).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight resume across concurrent chord notes', async () => {
    const fake = createAudioContext();
    installAudioContext(fake.context);
    installSuccessfulFetch();
    const sampler = new Sampler();
    await sampler.loadSample('c/4', '/C4.mp3');
    await sampler.loadSample('e/4', '/E4.mp3');

    const playback = Promise.all([sampler.play('c/4'), sampler.play('e/4')]);

    expect(fake.context.resume).toHaveBeenCalledTimes(1);
    expect(fake.context.createBufferSource).not.toHaveBeenCalled();

    fake.resumeGate.resolve();
    await playback;

    expect(fake.bufferSources).toHaveLength(2);
    expect(fake.bufferSources.every((source) => source.start.mock.calls.length === 1)).toBe(true);
  });

  it('starts no node when context activation fails', async () => {
    const fake = createAudioContext();
    installAudioContext(fake.context);
    const sampler = new Sampler();

    const playback = sampler.play('c/4');
    fake.resumeGate.reject(new Error('blocked'));

    await expect(playback).rejects.toThrow('blocked');
    expect(fake.context.createBufferSource).not.toHaveBeenCalled();
    expect(fake.context.createOscillator).not.toHaveBeenCalled();
  });

  it('rejects playback when resume resolves without a running context', async () => {
    const fake = createAudioContext({ resumeSetsRunning: false });
    installAudioContext(fake.context);
    const sampler = new Sampler();

    const playback = sampler.play('c/4');
    fake.resumeGate.resolve();

    await expect(playback).rejects.toThrow('Audio context failed to start');
    expect(fake.context.createOscillator).not.toHaveBeenCalled();
  });

  it('does not resume an already running context', async () => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    const sampler = new Sampler();

    await sampler.play('c/4');

    expect(fake.context.resume).not.toHaveBeenCalled();
    expect(fake.oscillators[0].start).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable Web Audio without starting playback', async () => {
    vi.stubGlobal('window', {});
    const sampler = new Sampler();

    await expect(sampler.play('c/4')).rejects.toThrow('Web Audio API is unavailable');
  });
});

describe('Sampler sample loading', () => {
  it('returns a loaded result and reuses the decoded buffer', async () => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    const { fetchMock } = installSuccessfulFetch();
    const sampler = new Sampler();

    await expect(sampler.loadSample('c/4', '/C4.mp3')).resolves.toEqual({
      note: 'c/4',
      status: 'loaded',
    });
    await sampler.play('c/4');

    expect(fetchMock).toHaveBeenCalledWith('/C4.mp3');
    expect(fake.bufferSources[0].buffer).toBe(fake.decodedBuffer);
  });

  it('returns a failed result for a non-OK response without decoding it', async () => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, arrayBuffer })),
    );
    const sampler = new Sampler();

    await expect(sampler.loadSample('c/4', '/missing.mp3')).resolves.toEqual({
      note: 'c/4',
      status: 'failed',
    });

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(fake.context.decodeAudioData).not.toHaveBeenCalled();
  });

  it.each(['fetch', 'decode'] as const)(
    'returns a failed result after a %s failure',
    async (stage) => {
      const fake = createAudioContext({ initialState: 'running' });
      installAudioContext(fake.context);
      if (stage === 'fetch') {
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => Promise.reject(new Error('network'))),
        );
      } else {
        installSuccessfulFetch();
        fake.context.decodeAudioData.mockRejectedValueOnce(new Error('decode'));
      }
      const sampler = new Sampler();

      await expect(sampler.loadSample('c/4', '/C4.mp3')).resolves.toEqual({
        note: 'c/4',
        status: 'failed',
      });
    },
  );

  it('summarizes partial and complete piano loading failures', async () => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    const fetchMock = vi.fn(async (url: string) => ({
      ok: !url.endsWith('/C2.mp3'),
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const sampler = new Sampler();

    await expect(sampler.loadPianoSamples()).resolves.toEqual({
      failed: 1,
      loaded: 48,
      total: 49,
    });

    fetchMock.mockImplementation(async () => ({
      ok: false,
      arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    }));

    await expect(new Sampler().loadPianoSamples()).resolves.toEqual({
      failed: 49,
      loaded: 0,
      total: 49,
    });
  });
});

describe('Sampler note normalization and fallback', () => {
  it('uses a sharp-keyed piano buffer for an enharmonic flat note', async () => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    installSuccessfulFetch();
    const sampler = new Sampler();
    await sampler.loadSample('c#/4', '/Db4.mp3');

    await sampler.play('db/4');

    expect(fake.bufferSources[0].buffer).toBe(fake.decodedBuffer);
    expect(fake.context.createOscillator).not.toHaveBeenCalled();
  });

  it.each([
    ['db/4', 277.1826],
    ['a/4', 440],
  ])('plays %s through the oscillator at %f Hz when no sample is loaded', async (note, hz) => {
    const fake = createAudioContext({ initialState: 'running' });
    installAudioContext(fake.context);
    const sampler = new Sampler();

    await sampler.play(note);

    expect(fake.oscillators[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      expect.closeTo(hz, 4),
      0,
    );
    expect(fake.oscillators[0].start).toHaveBeenCalledTimes(1);
  });
});
