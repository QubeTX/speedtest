/**
 * One-off generator for golden-vectors.json (SpeedQX Methodology v4).
 *
 * Computes every expected value FROM the reference TypeScript implementation and
 * writes it to the repo-root fixture. The committed fixture is the portability
 * contract: the TS test suite asserts against it, and the Rust CLI port asserts
 * against the byte-identical copy (bit-exact for arithmetic paths, 1e-9 relative
 * for the invNormal/BCa/CS transcendental paths).
 *
 * Regenerate with:  npm run gen:golden
 *
 * Input sample arrays are synthesized deterministically (documented below) and
 * stored as literals, so cross-language reproducibility depends only on the
 * OUTPUT computations, never on regenerating the inputs.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { PCG32, quantile } from '../src/services/stat-primitives';
import {
  plateauStart,
  hodgesLehmann,
  circularBlockBootstrap,
  modifiedTrimean,
  filterOutliersIQR,
  mergeProviders,
  jitterMetrics,
  bufferbloatDelta,
  rpm,
  empiricalBernsteinCS,
  type MergeProviderInput,
} from '../src/services/statistics';

const SIZES = [12, 27, 60, 200] as const;

// ── Deterministic input synthesis ────────────────────────────────────────
// One shared PCG32 stream (default initializer) threaded across the four
// arrays. Each sample = plateau·ramp + uniform noise (±5%); a few fixed spikes
// exercise the IQR filter. Stored as literals — generation need not be portable.
function makeSamples(
  rng: PCG32,
  n: number,
  plateau: number,
  rampFrac: number,
  spikes: [number, number][],
): number[] {
  const rampLen = Math.max(1, Math.floor(n * rampFrac));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const ramp = i < rampLen ? (i + 1) / (rampLen + 1) : 1;
    const noise = (rng.nextDouble() - 0.5) * 0.10 * plateau;
    out.push(plateau * ramp + noise);
  }
  for (const [idx, mult] of spikes) if (idx >= 0 && idx < n) out[idx] = plateau * mult;
  return out;
}

const inputRng = new PCG32();
const synthParams: Record<number, { plateau: number; rampFrac: number; spikes: [number, number][] }> = {
  12: { plateau: 95, rampFrac: 0.25, spikes: [] },
  27: { plateau: 240, rampFrac: 0.2, spikes: [[15, 2.2]] },
  60: { plateau: 480, rampFrac: 0.15, spikes: [[30, 2.5], [45, 0.25]] },
  200: { plateau: 930, rampFrac: 0.12, spikes: [[120, 2.6], [160, 0.2]] },
};

const samples: Record<string, number[]> = {};
for (const n of SIZES) {
  const p = synthParams[n];
  samples[String(n)] = makeSamples(inputRng, n, p.plateau, p.rampFrac, p.spikes);
}

// ── PCG32 golden stream (fresh default-initialized generators) ───────────
const prng = new PCG32();
const first64U32: number[] = [];
for (let i = 0; i < 64; i++) first64U32.push(prng.nextU32());

const boundedStreams: Record<string, number[]> = {};
for (const n of SIZES) {
  const r = new PCG32();
  const arr: number[] = [];
  for (let i = 0; i < 32; i++) arr.push(r.boundedIndex(n));
  boundedStreams[String(n)] = arr;
}

// ── quantile golden cases ────────────────────────────────────────────────
const quantileInputs: { sorted: number[]; p: number }[] = [
  { sorted: [1, 2, 3, 4], p: 0.0 },
  { sorted: [1, 2, 3, 4], p: 0.25 },
  { sorted: [1, 2, 3, 4], p: 0.5 },
  { sorted: [1, 2, 3, 4], p: 0.75 },
  { sorted: [1, 2, 3, 4], p: 1.0 },
  { sorted: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], p: 0.1 },
  { sorted: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], p: 0.9 },
  { sorted: [5, 5, 5, 5], p: 0.42 },
  { sorted: [1, 4, 9, 16, 25, 36, 49], p: 0.95 },
];
const quantileCases = quantileInputs.map((c) => ({ ...c, expected: quantile(c.sorted, c.p) }));

// ── per-provider pipeline (plateau → IQR → trimean/HL → block bootstrap) ─
const perProvider: Record<string, unknown> = {};
for (const n of SIZES) {
  const raw = samples[String(n)];
  const ps = plateauStart(raw);
  const discarded = raw.slice(ps);
  const cleaned = filterOutliersIQR(discarded, 1.5);
  const boot = circularBlockBootstrap(cleaned, new PCG32(), 2000);
  perProvider[String(n)] = {
    plateauStart: ps,
    discardedLength: discarded.length,
    cleaned,
    trimean: modifiedTrimean(cleaned),
    hodgesLehmann: hodgesLehmann(cleaned),
    bootstrap: {
      blockLength: boot.blockLength,
      B: boot.B,
      thetaHat: boot.thetaHat,
      thetaStarMean: boot.thetaStarMean,
      variance: boot.variance,
      ciLower: boot.ciLower,
      ciUpper: boot.ciUpper,
    },
  };
}

// ── cross-provider merge triples ─────────────────────────────────────────
const mergeInputs: { label: string; providers: MergeProviderInput[] }[] = [
  {
    label: 'k3-high-agreement',
    providers: [
      { name: 'cloudflare', y: 920, v: 25, samples: 40 },
      { name: 'msak', y: 890, v: 40, samples: 32 },
      { name: 'ndt7', y: 780, v: 60, samples: 28 },
    ],
  },
  {
    label: 'k2-union-band',
    providers: [
      { name: 'cloudflare', y: 500, v: 30, samples: 36 },
      { name: 'ndt7', y: 420, v: 50, samples: 24 },
    ],
  },
  {
    label: 'k4-unknown-var-and-exclusion',
    providers: [
      { name: 'cloudflare', y: 950, v: 20, samples: 40 },
      { name: 'vultr', y: 940, v: 15, samples: 18 },
      { name: 'librespeed', y: 930, v: NaN, samples: 30 },
      { name: 'ndt7', y: 610, v: 80, samples: 25 },
      { name: 'cachefly', y: 900, v: 22, samples: 3 },
    ],
  },
  {
    label: 'k1-passthrough',
    providers: [
      { name: 'cloudflare', y: 615, v: 18, samples: 33, bca: { lower: 590, upper: 640 } },
      { name: 'ndt7', y: 600, v: 40, samples: 2 },
    ],
  },
  {
    label: 'k3-degenerate-equal',
    providers: [
      { name: 'cloudflare', y: 500, v: 10, samples: 20 },
      { name: 'msak', y: 500, v: 10, samples: 20 },
      { name: 'ndt7', y: 500, v: 10, samples: 20 },
    ],
  },
];
const mergeCases = mergeInputs.map((c) => ({
  label: c.label,
  providers: c.providers,
  expected: mergeProviders(c.providers),
}));

// ── jitter / bufferbloat / RPM ───────────────────────────────────────────
const rttSamples = [20.1, 21.3, 19.8, 25.6, 20.0, 22.2, 100.5, 19.9, 20.4, 23.1, 21.0, 20.7, 24.4, 19.5, 22.9];
const jitter = { samples: rttSamples, ...jitterMetrics(rttSamples) };

const idleRtts = [18.0, 19.0, 20.0, 18.5, 19.2, 20.1, 19.8, 18.9, 19.5, 20.3];
const loadedRtts = [45.0, 60.0, 80.0, 55.0, 120.0, 48.0, 52.0, 70.0, 300.0, 58.0, 64.0, 90.0];
const bufferbloat = { idle: idleRtts, loaded: loadedRtts, ...bufferbloatDelta(idleRtts, loadedRtts), rpm: rpm(loadedRtts) };

// ── empirical-Bernstein CS widths at t ∈ {12, 25, 50} ────────────────────
const ebSource = samples['60'];
const ebcs: Record<string, unknown> = {};
for (const t of [12, 25, 50]) {
  const cs = empiricalBernsteinCS(ebSource.slice(0, t));
  ebcs[String(t)] = { t: cs.t, U: cs.U, muHatMbps: cs.muHatMbps, halfWidthMbps: cs.halfWidthMbps, width: cs.width, stop: cs.stop };
}

// ── assemble + write ─────────────────────────────────────────────────────
const golden = {
  meta: {
    methodologyVersion: '4.0',
    generator: 'scripts/generate-golden-vectors.ts',
    note: 'Regenerate with `npm run gen:golden`. Arithmetic paths bit-exact; invNormal/BCa/CS 1e-9 relative.',
    pcg32: { state: '0x853c49e6748fea9b', inc: '0xda3e39cb94b95bdb' },
    bootstrap: { B: 2000, rng: 'fresh PCG32() default-initialized per case' },
  },
  pcg32: { first64U32, bounded: boundedStreams },
  quantile: quantileCases,
  samples,
  perProvider,
  merge: mergeCases,
  jitter,
  bufferbloat,
  ebcs,
};

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../golden-vectors.json');
writeFileSync(outPath, JSON.stringify(golden, null, 2) + '\n', 'utf8');
console.log(`Wrote ${outPath}`);
console.log(`PCG32 first4: ${first64U32.slice(0, 4).join(', ')}`);
for (const n of SIZES) {
  const pp = perProvider[String(n)] as { plateauStart: number; cleaned: number[]; trimean: number };
  console.log(`n=${n}: plateauStart=${pp.plateauStart} cleaned=${pp.cleaned.length} trimean=${pp.trimean.toFixed(4)}`);
}
