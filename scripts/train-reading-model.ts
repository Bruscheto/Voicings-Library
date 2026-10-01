#!/usr/bin/env ts-node

/**
 * Fit the reading model's feature weights (packages/harmony/src/readingModel.ts).
 *
 * Training data is synthetic: chords are sampled by how often the jazz corpus
 * writes them (chord-prior.json), given the colour tones pianists add to what
 * is written (a written G7 is often played as G13), and voiced the way a
 * pianist would: rootless A/B, shells, root-plus-upper-structure spreads,
 * close position, drop 2 and inversions, in random keys and registers. The
 * model is a conditional logit: a softmax over each example's candidate
 * readings, maximising the probability of the chord that was voiced, with an
 * L2 pull towards the hand-set starting weights.
 *
 * The author-labelled seed and the Woodshed fixtures are held out and only
 * reported, never fitted.
 *
 * Usage: pnpm run harmony:train [--write]
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import prior from '../packages/harmony/src/data/chord-prior.json';
import woodshed from '../packages/harmony/fixtures/woodshed.json';
import { readingCandidates, type Candidate } from '../packages/harmony/src/detect';
import { mod12, pitchToMidi } from '../packages/harmony/src/pitch';
import {
  QUALITIES,
  familyOf,
  tensionInterval,
  type BaseQuality,
  type Family,
} from '../packages/harmony/src/qualities';
import { FEATURE_NAMES, type Weights } from '../packages/harmony/src/readingModel';
import { parseSymbol } from '../packages/harmony/src/symbol';

const SEED = 20261001;
// Corpus counts are raised to this power before sampling. Charts are mostly
// dominant and minor sevenths; people look up every kind of chord, so the
// training mix is flattened towards uniform.
const SAMPLING_POWER = Number(process.env.SAMPLING_POWER ?? 0.5);
const EXAMPLES = 20000;
const VALIDATION_SHARE = 0.2;
const EPOCHS = 400;
const LEARNING_RATE = 0.05;
const L2 = 0.02;
const ADAM_B1 = 0.9;
const ADAM_B2 = 0.999;
const ADAM_EPS = 1e-8;

// The hand-set weights the engine shipped with: the starting point, and what
// the L2 term pulls towards, so a rebuild always gives the same weights.
const HAND_WEIGHTS: Weights = {
  guideTones: 2,
  chordTones: 1,
  tensions: -0.5,
  avoidTensions: -1.5,
  rootPresent: 2,
  missingFifth: -1,
  thinVoicing: -2,
  completeRootless: 2,
  thinRootless: -3,
  rareRootless: -1.5,
  shellUnderneath: 0,
  bassRoot: 1.5,
  bassThird: 0.5,
  bassFifth: 0.5,
  bassSeventh: 0.5,
  bassTension: -2,
  logPQuality: 0.25,
  logPTensions: 0.25,
};

const OUT = path.resolve(__dirname, '../packages/harmony/src/data/reading-weights.json');
const SEED_CSV = path.resolve(__dirname, '../docs/data/voicings-seed.csv');

// --- Deterministic randomness -------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(SEED);
const chance = (p: number) => random() < p;
const randInt = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
function pick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// --- Chords as written, then as played -----------------------------------------

type Chord = { rootPc: number; quality: BaseQuality; tensions: string[] };

const NAMES = Object.entries(prior.names as Record<string, number>);
function sampleWritten(): Chord {
  const [name] = pick(
    NAMES,
    NAMES.map(([, n]) => n ** SAMPLING_POWER),
  );
  const [quality, tensions] = name.split('|');
  return {
    rootPc: randInt(0, 11),
    quality: quality as BaseQuality,
    tensions: tensions ? tensions.split(',') : [],
  };
}

// Colour tones a pianist adds to a written chord, with how often.
const COLOUR: Partial<Record<BaseQuality, [string, number][]>> = {
  '7': [
    ['9', 0.55],
    ['13', 0.45],
  ],
  min7: [
    ['9', 0.55],
    ['11', 0.25],
  ],
  Maj7: [
    ['9', 0.55],
    ['13', 0.15],
  ],
  '6': [['9', 0.45]],
  m6: [['9', 0.35]],
  mMaj7: [['9', 0.4]],
  m7b5: [
    ['11', 0.2],
    ['9', 0.1],
  ],
  '7sus4': [
    ['9', 0.5],
    ['13', 0.3],
  ],
  aug7: [['9', 0.15]],
  Maj: [['9', 0.15]],
};
const CLASHES: Record<string, string[]> = { '9': ['b9', '#9'], '13': ['b13'], '11': ['#11'] };

function played(chord: Chord): Chord {
  const tensions = [...chord.tensions];
  for (const [t, p] of COLOUR[chord.quality] ?? []) {
    if (tensions.includes(t) || (CLASHES[t] ?? []).some((c) => tensions.includes(c))) continue;
    if (chance(p)) tensions.push(t);
  }
  return { ...chord, tensions };
}

// --- Voicings -------------------------------------------------------------------

const roleInterval = (q: BaseQuality, role: string) =>
  Object.entries(QUALITIES[q].tones).find(([, tone]) => tone.role === role)?.[0];

/** Stack pitch classes upwards from a starting MIDI note, each above the last. */
function stack(startMidi: number, intervals: number[], rootPc: number): number[] {
  const out: number[] = [];
  let last = startMidi - 1;
  for (const interval of intervals) {
    let n = last + 1;
    while (mod12(n - rootPc) !== mod12(interval)) n++;
    out.push(n);
    last = n;
  }
  return out;
}

type VoicingKind = 'rootless' | 'shell' | 'spread' | 'ust' | 'close' | 'drop2' | 'inversion';
const SEVENTH_KINDS: VoicingKind[] = [
  'rootless',
  'shell',
  'spread',
  'ust',
  'close',
  'drop2',
  'inversion',
];
const SEVENTH_WEIGHTS = [0.25, 0.1, 0.2, 0.1, 0.1, 0.17, 0.08];
// Slash chords are mostly plain: C7/E rarely carries a 9th and 13th too.
const INVERSION_TENSION_CHANCE = 0.25;
const TRIAD_KINDS: VoicingKind[] = ['close', 'inversion', 'spread'];
const TRIAD_WEIGHTS = [0.4, 0.4, 0.2];

function voice(chord: Chord): { notes: number[]; kind: VoicingKind } | null {
  const { rootPc, quality } = chord;
  const third = Number(roleInterval(quality, 'third'));
  const fifthRaw = roleInterval(quality, 'fifth');
  const seventhRaw = roleInterval(quality, 'seventh');
  const fifth = fifthRaw === undefined ? undefined : Number(fifthRaw);
  const seventh = seventhRaw === undefined ? undefined : Number(seventhRaw);
  const tensions = chord.tensions
    .map((t) => tensionInterval(quality, t))
    .filter((i): i is number => i !== undefined);

  const hasSeventh = seventh !== undefined;
  const kind = hasSeventh ? pick(SEVENTH_KINDS, SEVENTH_WEIGHTS) : pick(TRIAD_KINDS, TRIAD_WEIGHTS);
  const fifthOrNone = fifth === undefined ? [] : [fifth];
  const lowBass = () => randInt(36, 47); // C2..B2
  const midStart = () => randInt(48, 57); // C3..A3

  switch (kind) {
    case 'rootless': {
      // 3rd and 7th plus two colour notes, tensions first.
      const colour = [...tensions, ...fifthOrNone].slice(0, 2);
      if (colour.length < 2) return null;
      const order = chance(0.5)
        ? [
            third,
            ...colour.filter((c) => c < seventh!),
            seventh!,
            ...colour.filter((c) => c > seventh!),
          ]
        : [seventh!, ...colour.filter((c) => c < third), third, ...colour.filter((c) => c > third)];
      return { kind, notes: stack(midStart(), order, rootPc) };
    }
    case 'shell': {
      const order = chance(0.5) ? [0, third, seventh!] : [0, seventh!, third];
      return { kind, notes: stack(lowBass() + 6, order, rootPc) };
    }
    case 'spread': {
      const bass = stack(lowBass(), [0], rootPc)[0];
      const upper = hasSeventh
        ? [third, seventh!, ...tensions, ...(chance(0.4) ? fifthOrNone : [])]
        : [...fifthOrNone, third, ...tensions];
      const shuffled = chance(0.5) ? upper : [...upper].reverse();
      return { kind, notes: [bass, ...stack(bass + randInt(5, 10), shuffled, rootPc)] };
    }
    case 'ust': {
      // Left-hand shell, then the tensions and 5th as a right-hand cluster.
      const top = [...tensions, ...fifthOrNone];
      if (top.length < 2) return null;
      const lh = stack(
        lowBass(),
        chance(0.5) ? [0, third, seventh!] : [0, seventh!, third],
        rootPc,
      );
      return { kind, notes: [...lh, ...stack(lh[2] + 1, top, rootPc)] };
    }
    case 'close': {
      const tones = [0, third, ...fifthOrNone, ...(hasSeventh ? [seventh!] : []), ...tensions];
      return { kind, notes: stack(midStart(), tones, rootPc) };
    }
    case 'drop2': {
      const four = [chance(0.4) && tensions.length ? tensions[0] : 0, third, fifth ?? 0, seventh!];
      const rotation = randInt(0, 3);
      const close = stack(
        midStart() + 12,
        [...four.slice(rotation), ...four.slice(0, rotation)],
        rootPc,
      );
      const dropped = [close[2] - 12, close[0], close[1], close[3]];
      return { kind, notes: dropped.sort((a, b) => a - b) };
    }
    case 'inversion': {
      const bassChoices = [third, ...fifthOrNone, ...(hasSeventh ? [seventh!] : [])];
      const bassInterval = bassChoices[randInt(0, bassChoices.length - 1)];
      const colour = chance(INVERSION_TENSION_CHANCE) ? tensions : [];
      const rest = [0, third, ...fifthOrNone, ...(hasSeventh ? [seventh!] : []), ...colour].filter(
        (i) => i !== bassInterval,
      );
      const bass = stack(lowBass() + 6, [bassInterval], rootPc)[0];
      return { kind, notes: [bass, ...stack(bass + 1, rest, rootPc)] };
    }
  }
}

// --- Examples and the conditional logit ---------------------------------------

type Example = { candidates: number[][]; correct: boolean[]; label: string };

const featureRow = (c: Candidate) => FEATURE_NAMES.map((name) => c.features[name]);

function makeExample(
  notes: number[],
  isIntended: (c: Candidate) => boolean,
  label: string,
): Example | null {
  const candidates = readingCandidates(notes);
  const correct = candidates.map(isIntended);
  if (!correct.some(Boolean)) return null;
  return { candidates: candidates.map(featureRow), correct, label };
}

const sameChord = (rootPc: number, family: Family) => (c: Candidate) =>
  c.rootPc === rootPc && c.family === family;

function syntheticExamples(): { examples: Example[]; dropped: number } {
  const examples: Example[] = [];
  let dropped = 0;
  while (examples.length < EXAMPLES) {
    const chord = played(sampleWritten());
    const voiced = voice(chord);
    if (!voiced) continue;
    const family = familyOf(chord.quality, chord.tensions);
    const example = makeExample(voiced.notes, sameChord(chord.rootPc, family), voiced.kind);
    if (example) examples.push(example);
    else dropped++;
  }
  return { examples, dropped };
}

function heldOut(): { seed: Example[]; woodshed: Example[] } {
  type Row = { pitches: string; symbols: string; status: string };
  const rows = parse(fs.readFileSync(SEED_CSV, 'utf8'), { columns: true, trim: true }) as Row[];
  const seed = rows
    .filter((r) => r.status === 'ready' && r.symbols)
    .map((r) => {
      const authored = r.symbols.split(';').map((s) => parseSymbol(s.trim()));
      return makeExample(
        r.pitches.split(' ').map(pitchToMidi),
        (c) => authored.some((a) => mod12(a.rootPc) === c.rootPc && a.quality === c.quality),
        r.pitches,
      );
    })
    .filter((e): e is Example => !!e);
  type Fixture = { midi: number[]; intended: { root_pc: number; family: Family } };
  const ws = (woodshed as Fixture[])
    .map((f) =>
      makeExample(f.midi, sameChord(f.intended.root_pc, f.intended.family), f.midi.join(' ')),
    )
    .filter((e): e is Example => !!e);
  return { seed, woodshed: ws };
}

const toVector = (w: Weights) => FEATURE_NAMES.map((name) => w[name]);
const toWeights = (v: number[]) =>
  Object.fromEntries(
    FEATURE_NAMES.map((name, i) => [name, Math.round(v[i] * 1000) / 1000]),
  ) as Weights;
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

/** Mean negative log-likelihood of the intended readings, and its gradient. */
function lossAndGradient(examples: Example[], w: number[]) {
  const grad = new Array(w.length).fill(0);
  let loss = 0;
  for (const ex of examples) {
    const p = softmax(ex.candidates.map((f) => dot(w, f)));
    const pCorrect = p.reduce((s, x, i) => s + (ex.correct[i] ? x : 0), 0);
    loss -= Math.log(Math.max(pCorrect, 1e-12));
    for (let i = 0; i < p.length; i++) {
      const posterior = ex.correct[i] ? p[i] / pCorrect : 0;
      const coeff = p[i] - posterior;
      if (coeff === 0) continue;
      ex.candidates[i].forEach((x, k) => (grad[k] += coeff * x));
    }
  }
  return { loss: loss / examples.length, grad: grad.map((g) => g / examples.length) };
}

function fit(examples: Example[], start: number[]): number[] {
  const w = [...start];
  const m = new Array(w.length).fill(0);
  const v = new Array(w.length).fill(0);
  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    const { loss, grad } = lossAndGradient(examples, w);
    for (let k = 0; k < w.length; k++) {
      const g = grad[k] + 2 * L2 * (w[k] - start[k]);
      m[k] = ADAM_B1 * m[k] + (1 - ADAM_B1) * g;
      v[k] = ADAM_B2 * v[k] + (1 - ADAM_B2) * g * g;
      const mHat = m[k] / (1 - ADAM_B1 ** epoch);
      const vHat = v[k] / (1 - ADAM_B2 ** epoch);
      w[k] -= (LEARNING_RATE * mHat) / (Math.sqrt(vHat) + ADAM_EPS);
    }
    if (epoch % 100 === 0) console.log(`  epoch ${epoch}: loss ${loss.toFixed(4)}`);
  }
  return w;
}

function evaluate(examples: Example[], w: number[]) {
  let top1 = 0;
  let top3 = 0;
  let nll = 0;
  for (const ex of examples) {
    const scores = ex.candidates.map((f) => dot(w, f));
    const p = softmax(scores);
    const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
    const rank = order.findIndex(([, i]) => ex.correct[i]);
    if (rank === 0) top1++;
    if (rank < 3) top3++;
    nll -= Math.log(
      Math.max(
        p.reduce((s, x, i) => s + (ex.correct[i] ? x : 0), 0),
        1e-12,
      ),
    );
  }
  const n = examples.length;
  return { top1: top1 / n, top3: top3 / n, nll: nll / n };
}

// Voicings whose reading a jazz pianist would not argue about.
const PROBES: [string, string][] = [
  ['B3 E4 F4 A4', 'G13/B'],
  ['C3 E3 B3 D4 F#4 A4', 'CMaj13(#11)'],
  ['C3 E3 G3', 'CMaj'],
  ['C3 E3 G3 A3', 'CMaj6'],
  ['E3 A3 D4 G4 B4', 'Emin7add11'],
  ['C3 F3 Bb3', 'C7sus4'],
  ['D3 F3 A3 C4 E4', 'Dmin9'],
  ['G2 F3 B3 E4', 'G7add13'],
  ['C3 E3 Bb3 Db4 Ab4', 'C7(b9,b13)'],
  ['E3 G3 B3 D4', 'Emin7'],
  ['C3 E3 Bb3 D#4 F#4 A4', 'C7(#9,#11)add13'],
  ['E3 G3 D4 C4', 'CMajadd9/E'],
];

function probe(w: number[]): string[] {
  return PROBES.map(([pitches, want]) => {
    const candidates = readingCandidates(pitches.split(' ').map(pitchToMidi));
    const scores = candidates.map((c) => dot(w, featureRow(c)));
    const p = softmax(scores);
    const top = scores.indexOf(Math.max(...scores));
    const got = candidates[top].symbol;
    return `${got === want ? 'ok  ' : 'MISS'} ${pitches.padEnd(20)} ${got} ${pct(p[top])}${got === want ? '' : ` (want ${want})`}`;
  });
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
function report(name: string, examples: Example[], before: number[], after: number[]) {
  const a = evaluate(examples, before);
  const b = evaluate(examples, after);
  console.log(
    `${name.padEnd(12)} top-1 ${pct(a.top1)} → ${pct(b.top1)}   top-3 ${pct(a.top3)} → ${pct(b.top3)}   nll ${a.nll.toFixed(3)} → ${b.nll.toFixed(3)}`,
  );
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const start = toVector(HAND_WEIGHTS);
  const { examples, dropped } = syntheticExamples();
  const split = Math.floor(examples.length * (1 - VALIDATION_SHARE));
  const train = examples.slice(0, split);
  const validation = examples.slice(split);
  console.log(
    `${examples.length} synthetic voicings (${dropped} dropped: intended chord not a candidate)`,
  );

  const learned = fit(train, start);
  const held = heldOut();
  console.log('\nheld-out agreement (hand → learned):');
  report('validation', validation, start, learned);
  report('seed', held.seed, start, learned);
  report('woodshed', held.woodshed, start, learned);

  const [before, after] = [probe(start), probe(learned)];
  console.log('\nprobes (hand | learned):');
  before.forEach((line, i) => console.log(`  ${line.padEnd(60)} | ${after[i]}`));

  const weights = toWeights(learned);
  console.log('\nweights:');
  for (const name of FEATURE_NAMES)
    console.log(
      `  ${name.padEnd(18)} ${String(HAND_WEIGHTS[name]).padStart(6)} → ${weights[name]}`,
    );
  if (write) {
    fs.writeFileSync(OUT, `${JSON.stringify(weights, null, 2)}\n`);
    console.log(`\nwrote ${path.relative(process.cwd(), OUT)}`);
  }
}
