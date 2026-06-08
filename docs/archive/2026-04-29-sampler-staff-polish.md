# Sampler Staff Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Voicings admin milestone production-ready enough to capture and verify voicings with reliable audio loading, clef-aware staff rendering, and a green build.

**Architecture:** Keep the current monorepo shape. Add small tested pure helpers inside `packages/music-engine` and `packages/sampler`, then wire those helpers into `apps/admin` without changing the admin workflow. Use local samples first, CDN second, oscillator last.

**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind, VexFlow, Web Audio API, Prisma SQLite, Vitest.

---

## Current State

- Git branch: `main`
- Working tree before planning: clean
- Existing plan files: none
- `npm run seed:dry-run`: passes, importing 2 ready rows and skipping 1 non-ready row
- `npm run build`: fails in `packages/music-engine/src/renderer.ts` because `document.getElementById()` returns `HTMLElement | null`, but VexFlow `Renderer` requires `string | HTMLCanvasElement | HTMLDivElement`
- Current focus file lists: sampler local assets, sampler fallback/status, staff clef/register hints, validation checklist
- No local samples exist under `apps/admin/public/samples/piano/`
- CSV has `clef_hint`, `register_low`, and `register_high`, but Prisma currently does not persist those fields

## Direction

Stay on the current post-admin milestone. Do not start the public library UI yet. First make the capture tool trustworthy: green build, deterministic renderer layout, audio loading status, and documented validation.

## Helpful Skills and Plugins

- `superpowers:subagent-driven-development`: recommended if executing this plan task-by-task with fresh workers and review checkpoints.
- `superpowers:executing-plans`: best fallback if executing inline in this session.
- `superpowers:test-driven-development`: use for Tasks 2 and 3 because both introduce tests before implementation.
- `superpowers:systematic-debugging`: use if `npm run build`, Vitest, VexFlow, or Web Audio behavior fails unexpectedly.
- `superpowers:verification-before-completion`: use before claiming the milestone is complete.
- `superpowers:requesting-code-review`: use after implementation and before final handoff.
- `browser-use:browser` or `playwright`: use for manual admin UI validation at `http://localhost:3001`; prefer `browser-use:browser` for in-app inspection and Playwright for repeatable screenshots or scripted checks.
- `context7`: use only if current VexFlow, Vitest, Next.js, or Web Audio API docs are needed while implementing.
- `frontend-design:frontend-design`: optional only if the admin status UI needs visual polish beyond the current status pill.

## File Structure

- Modify: `package.json`
  - Add a root `test` script that delegates to Turborepo.
- Modify: `packages/music-engine/package.json`
  - Add `test` script and Vitest dev dependency.
- Modify: `packages/music-engine/src/renderer.ts`
  - Export clef/layout types, pure note planning helper, and update `StaffRenderer.render()` to accept a clef hint.
- Create: `packages/music-engine/src/renderer.test.ts`
  - Unit tests for staff planning and the VexFlow container type guard.
- Modify: `packages/sampler/package.json`
  - Add `test` script and Vitest dev dependency.
- Modify: `packages/sampler/src/index.ts`
  - Add local-first sample URL resolution, typed loading result, status callback, and oscillator fallback status.
- Create: `packages/sampler/src/index.test.ts`
  - Unit tests for sample URL ordering, note filename mapping, and status aggregation.
- Modify: `apps/admin/app/page.tsx`
  - Display sampler status from the sampler package and pass a clef hint into the renderer.
- Create: `docs/testing/sampler-staff-validation.md`
  - Manual validation checklist for seed import, admin playback, and renderer behavior.

---

### Task 1: Test Harness

**Files:**
- Modify: `package.json`
- Modify: `packages/music-engine/package.json`
- Modify: `packages/sampler/package.json`

- [ ] **Step 1: Add root test script**

Update `package.json` scripts to include `test`:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "seed:import": "ts-node --project tsconfig.scripts.json scripts/import-voicings-from-csv.ts docs/data/voicings-seed.csv",
    "seed:dry-run": "ts-node --project tsconfig.scripts.json scripts/import-voicings-from-csv.ts docs/data/voicings-seed.csv --dry-run"
  }
}
```

- [ ] **Step 2: Add package test scripts**

Update `packages/music-engine/package.json`:

```json
{
  "name": "music-engine",
  "version": "0.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "vexflow": "^4.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

Update `packages/sampler/package.json`:

```json
{
  "name": "sampler",
  "version": "0.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` updates and exits with code 0.

- [ ] **Step 4: Run empty test command**

Run:

```bash
npm run test
```

Expected: Turborepo runs `vitest run` in `music-engine` and `sampler`; it may fail because no test files exist yet.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json packages/music-engine/package.json packages/sampler/package.json
git commit -m "test: add package test harness"
```

---

### Task 2: Clef-Aware Staff Planning

**Files:**
- Create: `packages/music-engine/src/renderer.test.ts`
- Modify: `packages/music-engine/src/renderer.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/music-engine/src/renderer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getRendererContainer, planStaffNotes } from './renderer';

describe('planStaffNotes', () => {
  it('splits auto mode into grand staff at C4', () => {
    expect(planStaffNotes(['e/3', 'g/3', 'b/3', 'd/4'], 'auto')).toEqual({
      mode: 'grand',
      trebleKeys: ['d/4'],
      bassKeys: ['e/3', 'g/3', 'b/3']
    });
  });

  it('keeps all notes in treble when requested', () => {
    expect(planStaffNotes(['e/3', 'g/3', 'b/3'], 'treble')).toEqual({
      mode: 'treble',
      trebleKeys: ['e/3', 'g/3', 'b/3'],
      bassKeys: []
    });
  });

  it('keeps all notes in bass when requested', () => {
    expect(planStaffNotes(['d/4', 'f#/4', 'a/4'], 'bass')).toEqual({
      mode: 'bass',
      trebleKeys: [],
      bassKeys: ['d/4', 'f#/4', 'a/4']
    });
  });

  it('uses grand staff when requested', () => {
    expect(planStaffNotes(['c/3', 'e/4'], 'grand')).toEqual({
      mode: 'grand',
      trebleKeys: ['e/4'],
      bassKeys: ['c/3']
    });
  });
});

describe('getRendererContainer', () => {
  it('returns null when the element is not a div', () => {
    const span = document.createElement('span');
    span.id = 'target';
    document.body.appendChild(span);

    expect(getRendererContainer('target')).toBeNull();
  });

  it('returns an HTMLDivElement for renderer use', () => {
    const div = document.createElement('div');
    div.id = 'vexflow-admin';
    document.body.appendChild(div);

    expect(getRendererContainer('vexflow-admin')).toBe(div);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace packages/music-engine run test
```

Expected: FAIL with missing exports for `getRendererContainer` and `planStaffNotes`.

- [ ] **Step 3: Implement renderer helpers and clef hint**

Replace `packages/music-engine/src/renderer.ts` with:

```ts
import Vex from 'vexflow';

export type ClefHint = 'auto' | 'grand' | 'treble' | 'bass';

export type StaffPlan = {
  mode: Exclude<ClefHint, 'auto'>;
  trebleKeys: string[];
  bassKeys: string[];
};

export type StaffRenderOptions = {
  clefHint?: ClefHint;
};

const parseOctave = (note: string): number | null => {
  const octave = note.split('/')[1];
  if (!octave) return null;
  const parsed = Number.parseInt(octave, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const planStaffNotes = (notes: string[], clefHint: ClefHint = 'auto'): StaffPlan => {
  if (clefHint === 'treble') {
    return { mode: 'treble', trebleKeys: notes, bassKeys: [] };
  }

  if (clefHint === 'bass') {
    return { mode: 'bass', trebleKeys: [], bassKeys: notes };
  }

  const trebleKeys: string[] = [];
  const bassKeys: string[] = [];

  notes.forEach(note => {
    const octave = parseOctave(note);
    if (octave !== null && octave < 4) {
      bassKeys.push(note);
    } else {
      trebleKeys.push(note);
    }
  });

  return {
    mode: 'grand',
    trebleKeys,
    bassKeys
  };
};

export const getRendererContainer = (divId: string): HTMLDivElement | null => {
  if (typeof document === 'undefined') return null;
  const div = document.getElementById(divId);
  return div instanceof HTMLDivElement ? div : null;
};

const transparentNote = (key: string, clef: 'treble' | 'bass') =>
  new Vex.Flow.StaveNote({ keys: [key], duration: 'w', clef }).setStyle({
    fillStyle: 'transparent',
    strokeStyle: 'transparent'
  });

export class StaffRenderer {
  private divId: string;

  constructor(divId: string) {
    this.divId = divId;
  }

  render(notes: string[], options: StaffRenderOptions = {}) {
    const div = getRendererContainer(this.divId);
    if (!div) return;

    div.innerHTML = '';

    const { Renderer, Stave, StaveNote, Formatter, StaveConnector, Accidental, Voice } = Vex.Flow;
    const plan = planStaffNotes(notes, options.clefHint ?? 'auto');
    const isGrand = plan.mode === 'grand';

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(500, isGrand ? 300 : 180);
    const context = renderer.getContext();

    const staveTreble = plan.mode !== 'bass' ? new Stave(50, 40, 400).addClef('treble') : null;
    const staveBass = plan.mode !== 'treble' ? new Stave(50, isGrand ? 160 : 40, 400).addClef('bass') : null;

    if (isGrand && staveTreble && staveBass) {
      const connector = new StaveConnector(staveTreble, staveBass);
      connector.setType(StaveConnector.type.BRACE);
      connector.setContext(context).draw();

      const lineLeft = new StaveConnector(staveTreble, staveBass);
      lineLeft.setType(StaveConnector.type.SINGLE_LEFT);
      lineLeft.setContext(context).draw();

      const lineRight = new StaveConnector(staveTreble, staveBass);
      lineRight.setType(StaveConnector.type.SINGLE_RIGHT);
      lineRight.setContext(context).draw();
    }

    staveTreble?.setContext(context).draw();
    staveBass?.setContext(context).draw();

    try {
      if (staveTreble) {
        const voiceTreble = new Voice({ num_beats: 4, beat_value: 4 });
        const note = plan.trebleKeys.length > 0
          ? new StaveNote({ keys: plan.trebleKeys, duration: 'w', clef: 'treble' })
          : transparentNote('b/4', 'treble');

        voiceTreble.addTickables([note]);
        Accidental.applyAccidentals([voiceTreble], 'C');
        new Formatter().joinVoices([voiceTreble]).format([voiceTreble], 350);
        voiceTreble.draw(context, staveTreble);
      }

      if (staveBass) {
        const voiceBass = new Voice({ num_beats: 4, beat_value: 4 });
        const note = plan.bassKeys.length > 0
          ? new StaveNote({ keys: plan.bassKeys, duration: 'w', clef: 'bass' })
          : transparentNote('d/3', 'bass');

        voiceBass.addTickables([note]);
        Accidental.applyAccidentals([voiceBass], 'C');
        new Formatter().joinVoices([voiceBass]).format([voiceBass], 350);
        voiceBass.draw(context, staveBass);
      }
    } catch (e) {
      console.error('VexFlow render error:', e);
    }
  }
}
```

- [ ] **Step 4: Run package test**

Run:

```bash
npm --workspace packages/music-engine run test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: the previous `HTMLElement` type error is gone. If another TypeScript error appears, stop and fix only that reported error.

- [ ] **Step 6: Commit**

```bash
git add packages/music-engine/src/renderer.ts packages/music-engine/src/renderer.test.ts
git commit -m "fix: add clef-aware staff planning"
```

---

### Task 3: Local-First Sampler Loading

**Files:**
- Create: `packages/sampler/src/index.test.ts`
- Modify: `packages/sampler/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/sampler/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildPianoSampleSources,
  midiToSampleKey,
  noteToFrequency,
  summarizeLoadResults
} from './index';

describe('midiToSampleKey', () => {
  it('uses VexFlow note keys and flat CDN filenames', () => {
    expect(midiToSampleKey(61)).toEqual({
      vfNote: 'c#/4',
      localFilename: 'Csharp4.mp3',
      cdnFilename: 'Db4.mp3'
    });
  });
});

describe('buildPianoSampleSources', () => {
  it('orders local sample before CDN fallback', () => {
    expect(buildPianoSampleSources(60, '/samples/piano/')).toEqual([
      '/samples/piano/C4.mp3',
      'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/acoustic_grand_piano-mp3/C4.mp3'
    ]);
  });
});

describe('summarizeLoadResults', () => {
  it('summarizes loaded, fallback, and failed sample counts', () => {
    expect(summarizeLoadResults([
      { note: 'c/4', status: 'loaded', source: '/samples/piano/C4.mp3' },
      { note: 'c#/4', status: 'fallback', source: 'https://example.com/Db4.mp3' },
      { note: 'd/4', status: 'failed' }
    ])).toBe('Samples: 1 local, 1 CDN, 1 synth fallback');
  });
});

describe('noteToFrequency', () => {
  it('calculates A4 as 440 Hz', () => {
    expect(noteToFrequency('a/4')).toBe(440);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm --workspace packages/sampler run test
```

Expected: FAIL with missing exported helpers.

- [ ] **Step 3: Implement sampler helpers and status reporting**

Replace `packages/sampler/src/index.ts` with:

```ts
export type SampleLoadStatus = 'loaded' | 'fallback' | 'failed';

export type SampleLoadResult = {
  note: string;
  status: SampleLoadStatus;
  source?: string;
};

export type SamplerOptions = {
  localBaseUrl?: string;
  cdnBaseUrl?: string;
  onStatusChange?: (message: string) => void;
};

type BrowserAudioContext = AudioContext & {
  webkitAudioContext?: typeof AudioContext;
};

const DEFAULT_LOCAL_BASE_URL = '/samples/piano/';
const DEFAULT_CDN_BASE_URL = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/MusyngKite/acoustic_grand_piano-mp3/';

const filenameNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const localFilenameNotes = ['C', 'Csharp', 'D', 'Dsharp', 'E', 'F', 'Fsharp', 'G', 'Gsharp', 'A', 'Asharp', 'B'];
const keys = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

export const midiToSampleKey = (midi: number) => {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;

  return {
    vfNote: `${keys[semitone]}/${octave}`,
    localFilename: `${localFilenameNotes[semitone]}${octave}.mp3`,
    cdnFilename: `${filenameNotes[semitone]}${octave}.mp3`
  };
};

export const buildPianoSampleSources = (
  midi: number,
  localBaseUrl = DEFAULT_LOCAL_BASE_URL,
  cdnBaseUrl = DEFAULT_CDN_BASE_URL
) => {
  const sampleKey = midiToSampleKey(midi);
  return [
    `${localBaseUrl}${sampleKey.localFilename}`,
    `${cdnBaseUrl}${sampleKey.cdnFilename}`
  ];
};

export const summarizeLoadResults = (results: SampleLoadResult[]) => {
  const local = results.filter(result => result.status === 'loaded' && result.source?.startsWith('/')).length;
  const cdn = results.filter(result => result.status === 'fallback').length;
  const failed = results.filter(result => result.status === 'failed').length;
  return `Samples: ${local} local, ${cdn} CDN, ${failed} synth fallback`;
};

export const noteToFrequency = (note: string) => {
  const match = note.match(/([a-g][#b]?)\/(\d)/);
  if (!match) return 440;

  const normalizedNote = match[1]
    .replace('db', 'c#')
    .replace('eb', 'd#')
    .replace('gb', 'f#')
    .replace('ab', 'g#')
    .replace('bb', 'a#');
  const octave = Number.parseInt(match[2], 10);
  const semitoneIndex = keys.indexOf(normalizedNote);
  if (semitoneIndex === -1) return 440;

  const midi = (octave + 1) * 12 + semitoneIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export class Sampler {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private options: Required<SamplerOptions>;

  constructor(options: SamplerOptions = {}) {
    this.options = {
      localBaseUrl: options.localBaseUrl ?? DEFAULT_LOCAL_BASE_URL,
      cdnBaseUrl: options.cdnBaseUrl ?? DEFAULT_CDN_BASE_URL,
      onStatusChange: options.onStatusChange ?? (() => undefined)
    };
  }

  init() {
    if (typeof window !== 'undefined' && !this.context) {
      const AudioContextConstructor = window.AudioContext || (window as unknown as BrowserAudioContext).webkitAudioContext;
      this.context = new AudioContextConstructor();
    }
  }

  async loadSample(note: string, sources: string[]): Promise<SampleLoadResult> {
    if (!this.context) this.init();
    if (!this.context) return { note, status: 'failed' };

    for (const [index, source] of sources.entries()) {
      try {
        const response = await fetch(source);
        if (!response.ok) continue;

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers.set(note, audioBuffer);

        return {
          note,
          status: index === 0 ? 'loaded' : 'fallback',
          source
        };
      } catch {
        continue;
      }
    }

    return { note, status: 'failed' };
  }

  async loadPianoSamples() {
    if (!this.context) this.init();

    const promises: Promise<SampleLoadResult>[] = [];
    for (let midi = 36; midi <= 84; midi++) {
      const { vfNote } = midiToSampleKey(midi);
      promises.push(this.loadSample(vfNote, buildPianoSampleSources(midi, this.options.localBaseUrl, this.options.cdnBaseUrl)));
    }

    const results = await Promise.all(promises);
    this.options.onStatusChange(summarizeLoadResults(results));
    return results;
  }

  play(note: string) {
    if (!this.context) this.init();
    if (!this.context) return;

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }

    const buffer = this.buffers.get(note);
    if (!buffer) {
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
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(noteToFrequency(note), this.context.currentTime);

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.context.destination);

    osc.start();
    osc.stop(this.context.currentTime + 1.5);
  }
}
```

- [ ] **Step 4: Run package test**

Run:

```bash
npm --workspace packages/sampler run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/sampler/src/index.ts packages/sampler/src/index.test.ts
git commit -m "feat: load sampler assets local first"
```

---

### Task 4: Admin Status and Clef Wiring

**Files:**
- Modify: `apps/admin/app/page.tsx`

- [ ] **Step 1: Write failing check**

Run:

```bash
npm run build
```

Expected before code changes: build may pass after Task 2, but admin does not yet pass `clefHint` to `StaffRenderer.render()` and does not receive sampler package status.

- [ ] **Step 2: Wire sampler status callback**

Change the top-level sampler initialization in `apps/admin/app/page.tsx` from:

```ts
const sampler = new Sampler();
```

to:

```ts
let sampler: Sampler | null = null;
```

Inside `AdminPage()`, add:

```ts
if (!sampler) {
  sampler = new Sampler({
    onStatusChange: message => setSampleStatus(message)
  });
}
```

Update every sampler call to guard the nullable value:

```ts
sampler?.init();
sampler?.play(noteToVexFlow(noteName));
void sampler?.loadPianoSamples()
  .then(() => setSampleStatus(current => current.includes('Samples:') ? current : 'Piano Ready'))
  .catch(() => setSampleStatus('Piano Failed (Synth)'));
```

- [ ] **Step 3: Pass clef hint into renderer**

Add this helper near the other helpers in `apps/admin/app/page.tsx`:

```ts
const getClefHint = (notes: string[]) => {
  if (notes.length === 0) return 'grand' as const;

  const midiNumbers = notes.map(noteToMidi);
  const min = Math.min(...midiNumbers);
  const max = Math.max(...midiNumbers);

  if (max < 60) return 'bass' as const;
  if (min >= 60) return 'treble' as const;
  return 'grand' as const;
};
```

Update the renderer effect:

```ts
useEffect(() => {
  if (rendererRef.current) {
    const vfNotes = sortedActiveNotes.map(noteToVexFlow);
    rendererRef.current.render(vfNotes, { clefHint: getClefHint(sortedActiveNotes) });
  }
}, [sortedActiveNotes]);
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/page.tsx
git commit -m "feat: show sampler status in admin"
```

---

### Task 5: Validation Checklist

**Files:**
- Create: `docs/testing/sampler-staff-validation.md`

- [ ] **Step 1: Create validation checklist**

Create `docs/testing/sampler-staff-validation.md`:

```md
# Sampler and Staff Validation

## Automated

- Run `npm run seed:dry-run`.
  - Expected: two ready rows are listed for dry-run import.
  - Expected: one non-ready row is skipped.
- Run `npm run test`.
  - Expected: `music-engine` and `sampler` Vitest suites pass.
- Run `npm run build`.
  - Expected: both `apps/web` and `apps/admin` complete production builds.

## Manual Admin Playback

- Run `npm --workspace apps/admin run dev`.
- Open `http://localhost:3001`.
- Select `C3`, `E3`, `G3`.
  - Expected: staff renders in bass clef.
  - Expected: interval labels appear under active keys.
  - Expected: Play triggers piano sample audio if samples loaded, otherwise synth fallback.
- Select `C4`, `E4`, `G4`.
  - Expected: staff renders in treble clef.
- Select `E3`, `G3`, `B3`, `D4`.
  - Expected: staff renders as grand staff.
- Press Space.
  - Expected: selected notes play together.
- Toggle Arpeggio and press Space.
  - Expected: selected notes play in ascending order.

## Local Sample Assets

- Add files to `apps/admin/public/samples/piano/` using names like `C4.mp3`, `Csharp4.mp3`, `D4.mp3`.
- Reload admin.
  - Expected: sampler status reports local sample count above 0.
- Temporarily remove local samples and reload admin.
  - Expected: sampler status reports CDN count or synth fallback count.
```

- [ ] **Step 2: Run verification**

Run:

```bash
npm run seed:dry-run
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Commit**

```bash
git add docs/testing/sampler-staff-validation.md
git commit -m "docs: add sampler staff validation checklist"
```

---

## Self-Review

- Spec coverage: covers every current focus item: local samples path, sampler fallback/status, clef/register-sensitive renderer, and validation checklist.
- Placeholder scan: no red-flag placeholders, no unspecified test work, no "similar to" steps.
- Type consistency: `ClefHint`, `StaffRenderOptions`, `SampleLoadResult`, and helper names are introduced before use and reused consistently.

## Final Verification

Run:

```bash
git status --short
npm run seed:dry-run
npm run test
npm run build
```

Expected:

```text
## git status should show no unrelated changes beyond the current task commit.
seed:dry-run passes with 2 ready rows and 1 skipped row.
test passes for music-engine and sampler.
build passes for web and admin.
```
