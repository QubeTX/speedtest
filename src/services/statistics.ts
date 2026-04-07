/**
 * Statistical utilities for accurate speed test measurement.
 *
 * Implements Ookla-style trimean, IQR outlier filtering, slow-start discard,
 * RFC 3550 jitter, and coefficient of variation for stability analysis.
 */

// ── Percentile ──────────────────────────────────────────────────────────

/** Linear-interpolation percentile on a pre-sorted array. p ∈ [0, 1]. */
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

/** Classic trimean: (Q1 + 2*median + Q3) / 4 */
export function trimean(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q2 = percentile(sorted, 0.50);
  const q3 = percentile(sorted, 0.75);
  return (q1 + 2 * q2 + q3) / 4;
}

/** Ookla-style modified trimean: (P10 + 8*P50 + P90) / 10 */
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
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ── Outlier filtering ───────────────────────────────────────────────────

/** Remove values outside [Q1 − k*IQR, Q3 + k*IQR]. Default k = 1.5. */
export function filterOutliersIQR(values: number[], k = 1.5): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return values.filter(v => v >= lo && v <= hi);
}

// ── Slow-start discard ──────────────────────────────────────────────────

/**
 * Discard the first `fraction` of samples to eliminate TCP slow-start
 * ramp-up contamination. Default: discard first 30%.
 */
export function discardSlowStart(values: number[], fraction = 0.3): number[] {
  if (values.length < 4) return values;
  const cutIndex = Math.ceil(values.length * fraction);
  return values.slice(cutIndex);
}

// ── Bandwidth pipeline ──────────────────────────────────────────────────

/**
 * Full accuracy pipeline for download bandwidth samples:
 * 1. Discard slow-start ramp-up (first 30%)
 * 2. Remove IQR outliers
 * 3. Compute modified trimean
 */
export function accurateBandwidth(samples: number[]): number {
  if (samples.length === 0) return 0;
  const afterSlowStart = discardSlowStart(samples);
  const cleaned = filterOutliersIQR(afterSlowStart);
  if (cleaned.length === 0) return modifiedTrimean(samples); // fallback to unfiltered
  return modifiedTrimean(cleaned);
}

/**
 * Upload-specific accuracy pipeline.
 * Upload ramp-up is slower and more variable than download due to
 * smaller send buffers and browser throttling. Following Speedtest.net's
 * methodology, we keep only the fastest 50% of post-warmup samples
 * before computing the trimean.
 *
 * Pipeline:
 * 1. Discard slow-start ramp-up (first 30%)
 * 2. Keep only the fastest 50% of remaining samples
 * 3. Remove IQR outliers
 * 4. Compute modified trimean
 */
export function accurateUploadBandwidth(samples: number[]): number {
  if (samples.length === 0) return 0;
  const afterSlowStart = discardSlowStart(samples);
  if (afterSlowStart.length < 2) return accurateBandwidth(samples);
  // Keep fastest 50%
  const sorted = [...afterSlowStart].sort((a, b) => b - a); // descending
  const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const cleaned = filterOutliersIQR(topHalf);
  if (cleaned.length === 0) return modifiedTrimean(topHalf);
  return modifiedTrimean(cleaned);
}

// ── Jitter ──────────────────────────────────────────────────────────────

/**
 * RFC 3550 jitter: exponentially weighted moving average of inter-arrival
 * variance. J[i] = J[i-1] + (|D(i-1,i)| - J[i-1]) / 16
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

/** Mean absolute deviation of consecutive samples (original method). */
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

// ── Confidence-weighted merge ───────────────────────────────────────────

/**
 * Weighted average of two values. If one is zero/missing, return the other.
 * `weightA` is the weight for `a`; `b` gets `1 - weightA`.
 */
export function weightedMerge(a: number, b: number, weightA: number): number {
  const hasA = a > 0;
  const hasB = b > 0;
  if (hasA && hasB) return a * weightA + b * (1 - weightA);
  return hasA ? a : b;
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
