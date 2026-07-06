/**
 * Statistical utilities for accurate speed test measurement.
 *
 * Split into two eras:
 *   • v3 estimators (percentile, classic/modified trimean, IQR filter, slow-start
 *     discard, RFC 3550 jitter, CV, percentile bootstrap, inverse-variance merge)
 *     — retained for back-compat with the current aggregated-provider pipeline.
 *   • v4 core (SpeedQX Methodology v4): plateau warm-up detection, Hodges–Lehmann
 *     cross-check, circular block bootstrap + BCa, DerSimonian–Laird τ² / I² with
 *     HKSJ confidence intervals, capacity/consensus hybrid merge, PDV/IPDV/MAD
 *     jitter, delta-ms bufferbloat + grade + RPM, and the empirical-Bernstein
 *     confidence sequence for FAST-mode early termination.
 *
 * The v4 functions build only on the pinned primitives in `stat-primitives.ts`
 * so the TypeScript and Rust implementations produce identical golden vectors.
 * Functions marked `@deprecated` still work but are superseded by v4 equivalents;
 * they will be removed once the N-provider orchestrator lands.
 */

import {
  quantile,
  invNormal,
  phi,
  t975,
  sum,
  sampleMean,
  sampleVariance,
  PCG32,
} from './stat-primitives';

// ── Percentile ──────────────────────────────────────────────────────────

/**
 * Linear-interpolation percentile on a pre-sorted array. p ∈ [0, 1].
 * Bit-identical to the pinned `quantile` primitive (kept as a stable alias for
 * existing importers).
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Trimean ─────────────────────────────────────────────────────────────

/**
 * Classic trimean: (Q1 + 2*median + Q3) / 4
 * @deprecated v4 uses the Ookla-style {@link modifiedTrimean} everywhere.
 */
export function trimean(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q2 = percentile(sorted, 0.50);
  const q3 = percentile(sorted, 0.75);
  return (q1 + 2 * q2 + q3) / 4;
}

/** Ookla-style modified trimean: (P10 + 8*P50 + P90) / 10 (type-7 percentiles). */
export function modifiedTrimean(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p10 = percentile(sorted, 0.10);
  const p50 = percentile(sorted, 0.50);
  const p90 = percentile(sorted, 0.90);
  return (p10 + 8 * p50 + p90) / 10;
}

// ── Central tendency ────────────────────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

// ── Outlier filtering ───────────────────────────────────────────────────

/** Remove values outside [Q1 − k*IQR, Q3 + k*IQR]. Default k = 1.5. No-op for n < 4. */
export function filterOutliersIQR(values: number[], k = 1.5): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return values.filter((v) => v >= lo && v <= hi);
}

// ── Slow-start discard ──────────────────────────────────────────────────

/**
 * Discard the first `fraction` of samples to eliminate TCP slow-start ramp-up.
 * @deprecated v4 replaces the fixed cut with the adaptive {@link plateauStart}.
 */
export function discardSlowStart(values: number[], fraction = 0.3): number[] {
  if (values.length < 4) return values;
  const cutIndex = Math.ceil(values.length * fraction);
  return values.slice(cutIndex);
}

// ── Bandwidth pipeline (v3) ─────────────────────────────────────────────

/**
 * Full accuracy pipeline for download bandwidth samples (v3).
 * @deprecated v4 pipeline is plateauStart → IQR → modifiedTrimean with a
 * Hodges–Lehmann cross-check ({@link hodgesLehmann}); see METHODOLOGY.md §5.
 */
export function accurateBandwidth(samples: number[]): number {
  if (samples.length === 0) return 0;
  const afterSlowStart = discardSlowStart(samples);

  const cleaned = filterOutliersIQR(afterSlowStart);
  const iqrResult = cleaned.length > 0 ? modifiedTrimean(cleaned) : modifiedTrimean(afterSlowStart);

  if (afterSlowStart.length >= 4) {
    const winsorized = winsorize(afterSlowStart);
    const winResult = modifiedTrimean(winsorized);
    if (iqrResult > 0 && winResult > 0) {
      const divergence = Math.abs(iqrResult - winResult) / Math.max(iqrResult, winResult);
      if (divergence > 0.15) {
        return (iqrResult + winResult) / 2;
      }
    }
  }
  return iqrResult;
}

/**
 * Upload-specific accuracy pipeline (v3): keep fastest 50% post-warmup.
 * @deprecated superseded by the v4 per-provider pipeline.
 */
export function accurateUploadBandwidth(samples: number[]): number {
  if (samples.length === 0) return 0;
  const afterSlowStart = discardSlowStart(samples);
  if (afterSlowStart.length < 2) return accurateBandwidth(samples);

  const sorted = [...afterSlowStart].sort((a, b) => b - a);
  const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const cleaned = filterOutliersIQR(topHalf);
  const iqrResult = cleaned.length > 0 ? modifiedTrimean(cleaned) : modifiedTrimean(topHalf);

  if (topHalf.length >= 4) {
    const winsorized = winsorize(topHalf);
    const winResult = modifiedTrimean(winsorized);
    if (iqrResult > 0 && winResult > 0) {
      const divergence = Math.abs(iqrResult - winResult) / Math.max(iqrResult, winResult);
      if (divergence > 0.15) {
        return (iqrResult + winResult) / 2;
      }
    }
  }
  return iqrResult;
}

// ── Jitter ──────────────────────────────────────────────────────────────

/**
 * RFC 3550 jitter: EWMA of inter-arrival variance. J[i] = J[i-1] + (|D| − J[i-1]) / 16.
 * v4 demotes this to a compatibility field; canonical jitter is {@link pdv}.
 */
export function jitterRFC3550(samples: number[]): number {
  if (samples.length < 2) return 0;
  let j = 0;
  for (let i = 1; i < samples.length; i++) {
    const d = Math.abs(samples[i] - samples[i - 1]);
    j += (d - j) / 16;
  }
  return j;
}

/** Mean absolute deviation of consecutive samples. Equivalent to v4 {@link ipdvMean}. */
export function jitterMAD(samples: number[]): number {
  if (samples.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < samples.length; i++) {
    total += Math.abs(samples[i] - samples[i - 1]);
  }
  return total / (samples.length - 1);
}

// ── Stability ───────────────────────────────────────────────────────────

/** Coefficient of variation (stddev / mean). Lower = more stable. */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stddev(values) / m;
}

// ── Confidence-weighted merge (v3) ──────────────────────────────────────

/**
 * Weighted average of two values; falls back to whichever is present.
 * @deprecated v4 uses the N-provider {@link mergeProviders} hybrid.
 */
export function weightedMerge(a: number, b: number, weightA: number): number {
  const hasA = a > 0;
  const hasB = b > 0;
  if (hasA && hasB) return a * weightA + b * (1 - weightA);
  return hasA ? a : b;
}

// ── Variance ───────────────────────────────────────────────────────────

/** Sample variance (Bessel's correction). */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

// ── Winsorization ──────────────────────────────────────────────────────

/**
 * Cap extreme values at the given percentiles instead of removing them.
 * @deprecated only referenced by the v3 pipeline cross-check.
 */
export function winsorize(values: number[], lower = 0.05, upper = 0.95): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const lo = percentile(sorted, lower);
  const hi = percentile(sorted, upper);
  return values.map((v) => Math.max(lo, Math.min(hi, v)));
}

// ── Bootstrap confidence interval (v3) ──────────────────────────────────

export interface BootstrapCI {
  estimate: number;
  lower: number;
  upper: number;
  margin: number;
}

/**
 * Percentile-method bootstrap CI using Math.random (non-deterministic).
 * @deprecated v4 uses the deterministic {@link circularBlockBootstrap} (PCG32 +
 * BCa). Retained until the orchestrator migrates.
 */
export function bootstrapCI(
  samples: number[],
  statFn: (s: number[]) => number = modifiedTrimean,
  B = 1000,
  alpha = 0.05,
): BootstrapCI {
  if (samples.length < 4) {
    const est = statFn(samples);
    return { estimate: est, lower: est, upper: est, margin: 0 };
  }
  const estimate = statFn(samples);
  const bootstrapStats: number[] = [];
  for (let b = 0; b < B; b++) {
    const resample = Array.from({ length: samples.length }, () =>
      samples[Math.floor(Math.random() * samples.length)],
    );
    bootstrapStats.push(statFn(resample));
  }
  bootstrapStats.sort((a, b) => a - b);
  const lower = percentile(bootstrapStats, alpha / 2);
  const upper = percentile(bootstrapStats, 1 - alpha / 2);
  return { estimate, lower, upper, margin: (upper - lower) / 2 };
}

// ── Inverse-variance merge (v3) ─────────────────────────────────────────

/**
 * Inverse-variance weighted merge of two estimates, clamped to [0.3, 0.7].
 * @deprecated v4 uses {@link mergeProviders} (DL random-effects + capacity tier).
 */
export function inverseVarianceMerge(
  a: number, varA: number,
  b: number, varB: number,
): { value: number; weightA: number; weightB: number } {
  if (a <= 0 && b <= 0) return { value: 0, weightA: 0.5, weightB: 0.5 };
  if (a <= 0) return { value: b, weightA: 0, weightB: 1 };
  if (b <= 0) return { value: a, weightA: 1, weightB: 0 };
  if (varA <= 0 && varB <= 0) return { value: (a + b) / 2, weightA: 0.5, weightB: 0.5 };
  if (varA <= 0) return { value: a, weightA: 1, weightB: 0 };
  if (varB <= 0) return { value: b, weightA: 0, weightB: 1 };

  const wA = 1 / varA;
  const wB = 1 / varB;
  const totalW = wA + wB;
  let weightA = wA / totalW;
  let weightB = wB / totalW;
  if (weightA < 0.3) { weightA = 0.3; weightB = 0.7; }
  else if (weightA > 0.7) { weightA = 0.7; weightB = 0.3; }
  return { value: a * weightA + b * weightB, weightA, weightB };
}

// ── Latency stats builder ───────────────────────────────────────────────

export interface LatencyStatsResult {
  samples: number[];
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  stddev: number;
  jitter: number;
  jitterMad: number;
}

export function computeLatencyStats(samples: number[]): LatencyStatsResult {
  if (samples.length === 0) {
    return { samples: [], p50: 0, p75: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0, stddev: 0, jitter: 0, jitterMad: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    samples,
    p50: percentile(sorted, 0.50),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(samples),
    stddev: stddev(samples),
    jitter: jitterRFC3550(samples),
    jitterMad: jitterMAD(samples),
  };
}

// ════════════════════════════════════════════════════════════════════════
// SpeedQX Methodology v4 core
// ════════════════════════════════════════════════════════════════════════

/** Minimum cleaned samples for a provider to qualify for the cross-provider merge. */
export const MIN_MERGE_SAMPLES = 4;

/** Capability priors (METHODOLOGY.md §3) keyed by lowercase provider registry name. */
export const CAPABILITY_PRIORS: Record<string, number> = {
  cloudflare: 1.0,
  applenq: 1.0,
  fastcom: 1.0,
  librespeed: 0.95,
  cachefly: 0.95,
  vultr: 0.95,
  msak: 0.85,
  ndt7: 0.70,
};

// ── Median helper (type-7, on a fresh sorted copy) ──────────────────────

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return quantile(s, 0.5);
}

// ── Plateau warm-up detector ─────────────────────────────────────────────

/**
 * Warm-up cut index (replaces the fixed 30% slow-start discard). Steady state
 * begins at the first index `t` where 3 consecutive samples sit within ±10% of
 * the forward median `median(samples[t..end])`; the cut is clamped to
 * [ceil(0.10·n), floor(0.40·n)]. For n < 8 (too few to detect) returns
 * ceil(0.30·n). Discard `samples[0 .. plateauStart)`.
 */
export function plateauStart(samples: number[]): number {
  const n = samples.length;
  if (n < 8) return Math.ceil(0.30 * n);

  const eps = 0.10;
  const wLen = 3;
  let tStar = -1;

  for (let t = 0; t <= n - wLen; t++) {
    const ref = medianOf(samples.slice(t));
    if (ref <= 0) continue;
    let ok = true;
    for (let s = t; s < t + wLen; s++) {
      if (Math.abs(samples[s] - ref) / ref >= eps) { ok = false; break; }
    }
    if (ok) { tStar = t; break; }
  }
  if (tStar < 0) tStar = Math.ceil(0.30 * n);

  const lo = Math.ceil(0.10 * n);
  const hi = Math.floor(0.40 * n);
  return Math.min(hi, Math.max(lo, tStar));
}

// ── Hodges–Lehmann estimator ─────────────────────────────────────────────

/**
 * Hodges–Lehmann location: median of all Walsh averages (x_i + x_j)/2 for i ≤ j.
 * Used as an internal robustness cross-check against the trimean.
 */
export function hodgesLehmann(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];
  const walsh: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      walsh.push((values[i] + values[j]) / 2);
    }
  }
  walsh.sort((a, b) => a - b);
  return quantile(walsh, 0.5);
}

// ── Circular block bootstrap + BCa ───────────────────────────────────────

export interface BlockBootstrapResult {
  /** Point estimate: modifiedTrimean(cleaned). */
  thetaHat: number;
  /** Mean of the B resample trimeans. */
  thetaStarMean: number;
  /** Bootstrap variance of the trimean (v_j for the merge; n-1 denominator). */
  variance: number;
  /** BCa lower bound (2.5%). */
  ciLower: number;
  /** BCa upper bound (97.5%). */
  ciUpper: number;
  /** Block length ℓ = max(2, round(n^(1/3))). */
  blockLength: number;
  /** Resample count B. */
  B: number;
}

function bcaBound(sortedThetaStar: number[], z0: number, a: number, alpha: number): number {
  const z = invNormal(alpha);
  const denom = 1 - a * (z0 + z);
  const adj = denom !== 0 ? z0 + (z0 + z) / denom : z0;
  let aa = phi(adj);
  if (!Number.isFinite(aa)) aa = alpha;
  aa = Math.min(Math.max(aa, 0), 1);
  return quantile(sortedThetaStar, aa);
}

/**
 * Circular block bootstrap of the modified trimean with BCa 95% interval.
 * Block length ℓ = max(2, round(n^(1/3))); numBlocks = ceil(n/ℓ); each resample
 * concatenates whole circular blocks (start via PCG32 + Lemire, wrapping mod n)
 * and is trimmed to n. The `rng` stream is caller-owned so the orchestrator can
 * thread ONE deterministic stream across DL then UL, per provider in registry
 * order (see the v4 notes). Returns the bootstrap variance for the merge.
 */
export function circularBlockBootstrap(cleaned: number[], rng: PCG32, B = 2000): BlockBootstrapResult {
  const n = cleaned.length;
  const thetaHat = modifiedTrimean(cleaned);
  if (n < 2) {
    return { thetaHat, thetaStarMean: thetaHat, variance: 0, ciLower: thetaHat, ciUpper: thetaHat, blockLength: n, B };
  }

  const l = Math.max(2, Math.round(Math.cbrt(n)));
  const numBlocks = Math.ceil(n / l);
  const thetaStar = new Array<number>(B);
  const resample = new Array<number>(n);

  for (let b = 0; b < B; b++) {
    let filled = 0;
    for (let blk = 0; blk < numBlocks && filled < n; blk++) {
      const start = rng.boundedIndex(n);
      for (let t = 0; t < l && filled < n; t++) {
        resample[filled++] = cleaned[(start + t) % n];
      }
    }
    thetaStar[b] = modifiedTrimean(resample);
  }

  const thetaStarMean = sampleMean(thetaStar);
  const bootVar = sampleVariance(thetaStar);
  const sortedTS = [...thetaStar].sort((a, b) => a - b);

  if (bootVar === 0) {
    return { thetaHat, thetaStarMean, variance: 0, ciLower: thetaHat, ciUpper: thetaHat, blockLength: l, B };
  }

  // Bias-correction z0
  let countLess = 0;
  for (let b = 0; b < B; b++) if (thetaStar[b] < thetaHat) countLess++;
  const EPS = 1e-12;
  const prop = Math.min(Math.max(countLess / B, EPS), 1 - EPS);
  const z0 = invNormal(prop);

  // Acceleration a via jackknife of the trimean
  const jack = new Array<number>(n);
  const loo = new Array<number>(n - 1);
  for (let i = 0; i < n; i++) {
    let idx = 0;
    for (let j = 0; j < n; j++) if (j !== i) loo[idx++] = cleaned[j];
    jack[i] = modifiedTrimean(loo);
  }
  const jackMean = sampleMean(jack);
  let s2 = 0;
  let s3 = 0;
  for (let i = 0; i < n; i++) {
    const d = jackMean - jack[i];
    s2 += d * d;
    s3 += d * d * d;
  }
  const aDen = 6 * Math.pow(s2, 1.5);
  const a = aDen !== 0 ? s3 / aDen : 0;

  const ciLower = bcaBound(sortedTS, z0, a, 0.025);
  const ciUpper = bcaBound(sortedTS, z0, a, 0.975);
  return { thetaHat, thetaStarMean, variance: bootVar, ciLower, ciUpper, blockLength: l, B };
}

// ── Cross-provider hybrid merge (DL τ² / I² + HKSJ + capacity/consensus) ─

export interface MergeProviderInput {
  /** Lowercase registry name (looks up {@link CAPABILITY_PRIORS}). */
  name: string;
  /** Point estimate (modified trimean) for this direction. */
  y: number;
  /** Bootstrap variance v_j; non-finite or ≤ 0 is treated as "unknown". */
  v: number;
  /** Cleaned sample count in this direction (qualification gate). */
  samples: number;
  /** Optional capability override; else CAPABILITY_PRIORS[name] ?? 1.0. */
  capability?: number;
  /** Provider's own BCa interval, used verbatim when k === 1. */
  bca?: { lower: number; upper: number };
}

export type AgreementBand = 'high' | 'moderate' | 'low' | 'very-low' | 'insufficient';

export interface MergeExclusion { name: string; samples: number; }

export interface MergeWeight {
  name: string;
  y: number;
  v: number;
  wStar: number;
  wStarCapped: number;
  wCap: number;
}

export interface MergeResult {
  /** Qualifying provider count (samples ≥ MIN_MERGE_SAMPLES). */
  k: number;
  /** Headline: capability-weighted top-tier robust mean. */
  capacity: number;
  /** Secondary: DL random-effects mean over all qualifying providers. */
  consensus: number;
  capacityCi: { lower: number; upper: number };
  consensusCi: { lower: number; upper: number };
  /** DerSimonian–Laird between-provider variance τ². */
  tau2: number;
  /** I² heterogeneity (null when k < 2). */
  i2: number | null;
  /** Cochran's Q (diagnostic). */
  q: number;
  band: AgreementBand;
  /** Provider names in the capacity tier. */
  tier: string[];
  weights: MergeWeight[];
  exclusions: MergeExclusion[];
}

function emptyMerge(exclusions: MergeExclusion[]): MergeResult {
  return {
    k: 0, capacity: 0, consensus: 0,
    capacityCi: { lower: 0, upper: 0 }, consensusCi: { lower: 0, upper: 0 },
    tau2: 0, i2: null, q: 0, band: 'insufficient', tier: [], weights: [], exclusions,
  };
}

/**
 * SpeedQX hybrid cross-provider merge for one direction (METHODOLOGY.md §6).
 *
 * Qualification: samples ≥ MIN_MERGE_SAMPLES; the rest are recorded in
 * `exclusions`. Unknown-variance qualifiers are assigned the maximum known
 * variance (least trusted); if no variance is known, all weights are equal.
 *
 * - k = 0 → empty result. k = 1 → passthrough with the provider's own BCa CI.
 * - k = 2 → capacity/consensus points computed, but CI is the honest union band
 *   `[min(y − 1.96·se), max(y + 1.96·se)]` and agreement = "insufficient".
 * - k ≥ 3 → DL τ²/I², capped (0.70) random-effects consensus with HKSJ CI, and
 *   the capability-weighted capacity tier (y ≥ 0.85·max, ≥ 2 members) with its
 *   own HKSJ CI over the tier.
 */
export function mergeProviders(inputs: MergeProviderInput[]): MergeResult {
  const exclusions: MergeExclusion[] = [];
  const qualifying: MergeProviderInput[] = [];
  for (const p of inputs) {
    if (p.samples >= MIN_MERGE_SAMPLES) qualifying.push(p);
    else exclusions.push({ name: p.name, samples: p.samples });
  }
  const k = qualifying.length;
  if (k === 0) return emptyMerge(exclusions);

  // Effective variances: unknown → max known; none known → 1 (equal weights).
  const knownVs: number[] = [];
  for (const p of qualifying) if (Number.isFinite(p.v) && p.v > 0) knownVs.push(p.v);
  const maxKnownV = knownVs.length ? Math.max(...knownVs) : NaN;
  const vEff = qualifying.map((p) =>
    (Number.isFinite(p.v) && p.v > 0) ? p.v : (knownVs.length ? maxKnownV : 1),
  );
  const capability = qualifying.map((p) => p.capability ?? CAPABILITY_PRIORS[p.name] ?? 1.0);

  if (k === 1) {
    const p = qualifying[0];
    const lo = p.bca ? p.bca.lower : p.y;
    const hi = p.bca ? p.bca.upper : p.y;
    const wStar = 1 / vEff[0];
    return {
      k: 1, capacity: p.y, consensus: p.y,
      capacityCi: { lower: lo, upper: hi }, consensusCi: { lower: lo, upper: hi },
      tau2: 0, i2: null, q: 0, band: 'insufficient', tier: [p.name],
      weights: [{ name: p.name, y: p.y, v: vEff[0], wStar, wStarCapped: wStar, wCap: capability[0] / vEff[0] }],
      exclusions,
    };
  }

  // DerSimonian–Laird heterogeneity (k ≥ 2).
  const w = vEff.map((v) => 1 / v);
  const sumW = sum(w);
  const muF = sum(qualifying.map((p, i) => w[i] * p.y)) / sumW;
  const q = sum(qualifying.map((p, i) => w[i] * (p.y - muF) ** 2));
  const sumW2 = sum(w.map((x) => x * x));
  const c = sumW - sumW2 / sumW;
  const tau2 = c > 0 ? Math.max(0, (q - (k - 1)) / c) : 0;
  const i2 = q > 0 ? Math.max(0, (q - (k - 1)) / q) : 0;

  // Random-effects weights with a single 0.70·Σ cap (defense in depth).
  const wStar = vEff.map((v) => 1 / (v + tau2));
  const sumWStar = sum(wStar);
  const cap = 0.70 * sumWStar;
  const wStarCapped = wStar.map((x) => Math.min(x, cap));
  const sumWStarCapped = sum(wStarCapped);
  const consensus = sum(qualifying.map((p, i) => wStarCapped[i] * p.y)) / sumWStarCapped;

  // Capacity tier: y ≥ 0.85·max; if k ≥ 3 and fewer than 2, take the top-2 by y.
  const ymax = Math.max(...qualifying.map((p) => p.y));
  let tierIdx: number[] = [];
  for (let i = 0; i < k; i++) if (qualifying[i].y >= 0.85 * ymax) tierIdx.push(i);
  if (k >= 3 && tierIdx.length < 2) {
    tierIdx = [...Array(k).keys()]
      .sort((i, j) => (qualifying[j].y - qualifying[i].y) || (i - j))
      .slice(0, 2)
      .sort((i, j) => i - j);
  }
  const wCap = vEff.map((v, i) => capability[i] / (v + tau2));
  const capDen = sum(tierIdx.map((i) => wCap[i]));
  const capacity = capDen > 0 ? sum(tierIdx.map((i) => wCap[i] * qualifying[i].y)) / capDen : ymax;

  let consensusCi: { lower: number; upper: number };
  let capacityCi: { lower: number; upper: number };
  let band: AgreementBand;

  if (k === 2) {
    const lower = Math.min(...qualifying.map((p, i) => p.y - 1.96 * Math.sqrt(vEff[i])));
    const upper = Math.max(...qualifying.map((p, i) => p.y + 1.96 * Math.sqrt(vEff[i])));
    consensusCi = { lower, upper };
    capacityCi = { lower, upper };
    band = 'insufficient';
  } else {
    // HKSJ over all qualifying → consensus CI.
    const qcNum = sum(qualifying.map((p, i) => wStarCapped[i] * (p.y - consensus) ** 2));
    const seC = Math.sqrt(Math.max(1, qcNum / (k - 1)) / sumWStarCapped);
    consensusCi = { lower: consensus - t975(k - 1) * seC, upper: consensus + t975(k - 1) * seC };

    // HKSJ over the tier (same RE weights) → capacity CI.
    const tierN = tierIdx.length;
    if (tierN >= 2) {
      const sumWStarTier = sum(tierIdx.map((i) => wStarCapped[i]));
      const qCapNum = sum(tierIdx.map((i) => wStarCapped[i] * (qualifying[i].y - capacity) ** 2));
      const seCap = Math.sqrt(Math.max(1, qCapNum / (tierN - 1)) / sumWStarTier);
      capacityCi = { lower: capacity - t975(tierN - 1) * seCap, upper: capacity + t975(tierN - 1) * seCap };
    } else {
      const i = tierIdx[0];
      const se = Math.sqrt(vEff[i]);
      capacityCi = { lower: qualifying[i].y - 1.96 * se, upper: qualifying[i].y + 1.96 * se };
    }

    band = i2 < 0.25 ? 'high' : i2 < 0.50 ? 'moderate' : i2 < 0.75 ? 'low' : 'very-low';
  }

  const weights: MergeWeight[] = qualifying.map((p, i) => ({
    name: p.name, y: p.y, v: vEff[i], wStar: wStar[i], wStarCapped: wStarCapped[i], wCap: wCap[i],
  }));

  return {
    k, capacity, consensus, capacityCi, consensusCi, tau2, i2, q,
    band, tier: tierIdx.map((i) => qualifying[i].name), weights, exclusions,
  };
}

// ── Jitter (PDV / IPDV / MAD) ────────────────────────────────────────────

/** Canonical jitter — packet delay variation: P95(RTT) − P50(RTT) (RFC 5481 flavor). */
export function pdv(rtts: number[]): number {
  if (rtts.length === 0) return 0;
  const s = [...rtts].sort((a, b) => a - b);
  return quantile(s, 0.95) - quantile(s, 0.5);
}

/** IPDV mean: mean of |consecutive ΔRTT|. */
export function ipdvMean(rtts: number[]): number {
  if (rtts.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < rtts.length; i++) total += Math.abs(rtts[i] - rtts[i - 1]);
  return total / (rtts.length - 1);
}

/** Robust scale: 1.4826 · median(|x − median(x)|). */
export function medianAbsoluteDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const med = medianOf(values);
  const dev = values.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  return 1.4826 * quantile(dev, 0.5);
}

export interface JitterMetrics {
  /** Canonical: P95 − P50. */
  pdv: number;
  /** Secondary: mean |ΔRTT|. */
  ipdvMean: number;
  /** Secondary: 1.4826 · MAD. */
  mad: number;
  /** Compatibility field only. */
  jitterRfc3550: number;
}

export function jitterMetrics(rtts: number[]): JitterMetrics {
  return {
    pdv: pdv(rtts),
    ipdvMean: ipdvMean(rtts),
    mad: medianAbsoluteDeviation(rtts),
    jitterRfc3550: jitterRFC3550(rtts),
  };
}

// ── Bufferbloat (delta-ms + grade) + RPM ─────────────────────────────────

export type BufferbloatGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

/** Grade the bufferbloat delta (ms): A+ <5 · A <30 · B <60 · C <200 · D <400 · F ≥400. */
export function bufferbloatGrade(deltaMs: number): BufferbloatGrade {
  if (deltaMs < 5) return 'A+';
  if (deltaMs < 30) return 'A';
  if (deltaMs < 60) return 'B';
  if (deltaMs < 200) return 'C';
  if (deltaMs < 400) return 'D';
  return 'F';
}

export interface BufferbloatDeltaResult {
  /** Canonical: P95(loaded RTT) − P50(idle RTT). */
  deltaMs: number;
  /** Secondary: P95(loaded) / P50(idle). */
  ratio: number;
  grade: BufferbloatGrade;
}

/** Delta-ms bufferbloat: P95(loaded) − P50(idle), graded; ratio disclosed as secondary. */
export function bufferbloatDelta(idleRtts: number[], loadedRtts: number[]): BufferbloatDeltaResult {
  const p50Idle = idleRtts.length ? quantile([...idleRtts].sort((a, b) => a - b), 0.5) : 0;
  const p95Loaded = loadedRtts.length ? quantile([...loadedRtts].sort((a, b) => a - b), 0.95) : 0;
  const deltaMs = p95Loaded - p50Idle;
  const ratio = p50Idle > 0 ? p95Loaded / p50Idle : 0;
  return { deltaMs, ratio, grade: bufferbloatGrade(deltaMs) };
}

/** Responsiveness (approx): 60000 / P50(loaded RTT ms) round-trips per minute. */
export function rpm(loadedRtts: number[]): number {
  if (loadedRtts.length === 0) return 0;
  const p50 = quantile([...loadedRtts].sort((a, b) => a - b), 0.5);
  return p50 > 0 ? 60000 / p50 : 0;
}

// ── FAST-mode empirical-Bernstein confidence sequence ───────────────────

export interface ConfidenceSequence {
  /** Samples consumed. */
  t: number;
  /** Rescaling cap U = 2·max(samples). */
  U: number;
  /** CS midpoint in Mbps. */
  muHatMbps: number;
  /** CS half-width in Mbps (the quantity the stop rule tests). */
  halfWidthMbps: number;
  /** Rescaled [0,1] half-width. */
  width: number;
  /** Stop early: t ≥ 12, RTT gate open, and halfWidth ≤ max(5%·est, 2 Mbps). */
  stop: boolean;
}

/**
 * Anytime-valid empirical-Bernstein confidence sequence for FAST-mode early
 * termination (METHODOLOGY.md §8). Samples (raw Mbps, time order) are rescaled
 * by U = 2·max into [0,1]; the running predictable-plug-in variance drives an
 * EB-style width. Stop when `halfWidthMbps ≤ max(0.05·estimate, 2 Mbps)` AND
 * `t ≥ 12`, unless the measured min-RTT gate (> 50 ms) forbids early stop.
 * α = 0.05. Caller applies the 25 s hard cap.
 */
export function empiricalBernsteinCS(
  samplesSoFar: number[],
  opts?: { alpha?: number; minRttMs?: number },
): ConfidenceSequence {
  const alpha = opts?.alpha ?? 0.05;
  const minRttMs = opts?.minRttMs ?? 0;
  const t = samplesSoFar.length;
  if (t === 0) return { t: 0, U: 0, muHatMbps: 0, halfWidthMbps: Infinity, width: Infinity, stop: false };

  let maxV = 0;
  for (let i = 0; i < t; i++) if (samplesSoFar[i] > maxV) maxV = samplesSoFar[i];
  const U = 2 * maxV;
  if (U <= 0) return { t, U: 0, muHatMbps: 0, halfWidthMbps: Infinity, width: Infinity, stop: false };

  let xSum = 0;
  let sig2Sum = 0;
  for (let i = 0; i < t; i++) {
    const x = samplesSoFar[i] / U;
    // Predictable (prior-only) running mean: muHat_i uses X_1..X_{i-1} plus the
    // 0.5 prior, NEVER the current sample. The anytime-valid guarantee of the
    // confidence sequence formally requires the comparator to be predictable;
    // the plug-in (inclusive) form is ~2-3% anti-conservative at small t.
    // Spec decision 2026-07-06 — mirrored in METHODOLOGY.md §8 and the Rust port.
    const muHatPrior = (0.5 + xSum) / (i + 1);
    const d = x - muHatPrior;
    sig2Sum += d * d;
    xSum += x;
  }
  const muHatT = (0.5 + xSum) / (t + 1);
  const sig2T = (0.25 + sig2Sum) / (t + 1);
  const lnTerm = Math.log(2 / alpha);
  const width = Math.sqrt(2 * sig2T * lnTerm / t) + 3 * lnTerm / t;
  const halfWidthMbps = width * U;
  const muHatMbps = muHatT * U;
  const gated = minRttMs > 50;
  const stop = !gated && t >= 12 && halfWidthMbps <= Math.max(0.05 * muHatMbps, 2.0);
  return { t, U, muHatMbps, halfWidthMbps, width, stop };
}
