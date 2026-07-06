/**
 * Pinned statistical primitives for SpeedQX Methodology v4.
 *
 * These five primitives are the portability contract between the TypeScript
 * (website + app WebView) and Rust (CLI) implementations. They MUST behave
 * identically across languages so golden-vector fixtures assert parity:
 *
 *   1. quantile(sorted, p)      — type-7 linear interpolation (BIT-EXACT)
 *   2. PCG32 + Lemire bounded   — deterministic PRNG index streams (BIT-EXACT)
 *   3. invNormal / phi          — Acklam / West rational approximations (1e-9 rel)
 *   4. t975 table               — hardcoded Student-t 0.975 quantiles (BIT-EXACT)
 *   5. fixed-order sum helpers   — deterministic summation order, no reassociation
 *
 * FP discipline (governing rule): fixed left-to-right summation order, no FMA /
 * fast-math, and NEVER use JavaScript's 32-bit `^ << >>` number operators on the
 * 64-bit PRNG state — BigInt only. See METHODOLOGY.md §11 and the v4 statistical
 * notes for the exact contract.
 */

// ── type-7 quantile ─────────────────────────────────────────────────────

/**
 * Type-7 (linear-interpolation) quantile on a pre-sorted ascending array.
 * `h = (n - 1) * p`, interpolate between the two bracketing order statistics.
 * BIT-EXACT primitive — identical formula in TS and Rust. `p` must be in [0, 1].
 */
export function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// ── PCG32 + Lemire bounded index ─────────────────────────────────────────

const MASK64 = 0xffffffffffffffffn;
const MASK32 = 0xffffffffn;

/** PCG32 LCG multiplier (Melissa O'Neill's reference constant). */
export const PCG32_MULT = 6364136223846793005n;
/** Default initial state (PCG reference `PCG32_INITIALIZER`). Pinned for golden vectors. */
export const PCG32_DEFAULT_STATE = 0x853c49e6748fea9bn;
/** Default stream increment (odd). Pinned for golden vectors. */
export const PCG32_DEFAULT_INC = 0xda3e39cb94b95bdbn;

/**
 * Lemire multiply-shift bounded index: `floor(u32 * n / 2^32)`.
 * Uses the full 64-bit product via BigInt, then shifts right 32 — never a
 * 32-bit JS bitwise op. Deterministic across TS and Rust. Returns [0, n).
 */
export function lemireBounded(u32: number, n: number): number {
  return Number((BigInt(u32) * BigInt(n)) >> 32n);
}

/**
 * PCG32 (permuted congruential generator, XSH-RR 64/32 variant).
 *
 * The 64-bit state is held as a BigInt and masked to 64 bits after every step.
 * The output permutation (xorshift + rotate) is computed in BigInt and truncated
 * to 32 bits, exactly mirroring the C reference. `inc` must be odd.
 */
export class PCG32 {
  private state: bigint;
  private readonly inc: bigint;

  constructor(state: bigint = PCG32_DEFAULT_STATE, inc: bigint = PCG32_DEFAULT_INC) {
    this.state = state & MASK64;
    this.inc = inc & MASK64;
  }

  /** Advance the state and return the next uniformly-distributed u32 as a Number in [0, 2^32). */
  nextU32(): number {
    const old = this.state;
    this.state = (old * PCG32_MULT + this.inc) & MASK64;
    const xorshifted = (((old >> 18n) ^ old) >> 27n) & MASK32; // u32 truncation
    const rot = old >> 59n; // 0..31
    const right = xorshifted >> rot;
    const left = (xorshifted << ((-rot) & 31n)) & MASK32; // 32-bit rotate-right
    return Number((right | left) & MASK32);
  }

  /** Lemire bounded index into [0, n) drawn from the next u32. */
  boundedIndex(n: number): number {
    return lemireBounded(this.nextU32(), n);
  }

  /** Next double in [0, 1): `nextU32() / 2^32`. Convenience for input synthesis. */
  nextDouble(): number {
    return this.nextU32() / 4294967296;
  }
}

// ── invNormal (Acklam) + phi (West) ──────────────────────────────────────

/**
 * Inverse standard-normal CDF via Peter Acklam's rational approximation.
 * Max relative error ≈ 1.15e-9 vs the true quantile (no Halley refinement, so
 * TS and Rust stay identical from the same constants). Returns ±Infinity at the
 * open boundaries. 1e-9-relative primitive.
 */
export function invNormal(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a1 = -3.969683028665376e1, a2 = 2.209460984245205e2, a3 = -2.759285104469687e2,
        a4 = 1.38357751867269e2, a5 = -3.066479806614716e1, a6 = 2.506628277459239e0;
  const b1 = -5.447609879822406e1, b2 = 1.615858368580409e2, b3 = -1.556989798598866e2,
        b4 = 6.680131188771972e1, b5 = -1.328068155288572e1;
  const c1 = -7.784894002430293e-3, c2 = -3.223964580411365e-1, c3 = -2.400758277161838e0,
        c4 = -2.549732539343734e0, c5 = 4.374664141464968e0, c6 = 2.938163982698783e0;
  const d1 = 7.784695709041462e-3, d2 = 3.224671290700398e-1, d3 = 2.445134137142996e0,
        d4 = 3.754408661907416e0;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
           ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
           (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
            ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
}

/**
 * Standard-normal CDF Φ(x) via Graeme West's `cumnorm` (Hart-style rational
 * approximation), accurate to ~1e-15 using only exp + arithmetic. Φ(0) = 0.5
 * exactly. 1e-9-relative primitive; the companion of invNormal for BCa.
 */
export function phi(x: number): number {
  const xa = Math.abs(x);
  if (xa > 37) return x > 0 ? 1 : 0;
  const e = Math.exp(-xa * xa / 2);
  let c: number;
  if (xa < 7.07106781186547) {
    let b = 3.52624965998911e-2 * xa + 0.700383064443688;
    b = b * xa + 6.37396220353165;
    b = b * xa + 33.912866078383;
    b = b * xa + 112.079291497871;
    b = b * xa + 221.213596169931;
    b = b * xa + 220.206867912376;
    const num = e * b;
    b = 8.83883476483184e-2 * xa + 1.75566716318264;
    b = b * xa + 16.064177579207;
    b = b * xa + 86.7807322029461;
    b = b * xa + 296.564248779674;
    b = b * xa + 637.333633378831;
    b = b * xa + 793.826512519948;
    b = b * xa + 440.413735824752;
    c = num / b;
  } else {
    let b = xa + 0.65;
    b = xa + 4 / b;
    b = xa + 3 / b;
    b = xa + 2 / b;
    b = xa + 1 / b;
    c = e / b / 2.506628274631;
  }
  return x > 0 ? 1 - c : c;
}

// ── Student-t 0.975 table ────────────────────────────────────────────────

/**
 * Hardcoded two-sided 95% Student-t quantiles (df → t). Pinned per spec;
 * df ∈ [1, 7] covers every reachable provider count (FULL mode: k = 7 browser /
 * k = 8 CLI → df = 7). Spec extension 2026-07-06, mirrored in METHODOLOGY.md §6.
 */
export const T975_TABLE: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
};

/**
 * Student-t 0.975 quantile for `df` degrees of freedom.
 * The canonical table (METHODOLOGY.md §6) is pinned for df ∈ [1, 7]. Above 7 we
 * clamp to df = 7 (2.365) — conservative (wider CI) and unreachable with the
 * current provider registry.
 */
export function t975(df: number): number {
  if (df <= 1) return T975_TABLE[1];
  if (df >= 7) return T975_TABLE[7];
  return T975_TABLE[df];
}

// ── fixed-order sum helpers ──────────────────────────────────────────────

/** Deterministic left-to-right sum. No pairwise/Kahan reassociation. */
export function sum(xs: number[]): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s;
}

/** Arithmetic mean via fixed-order sum. Returns 0 for the empty array. */
export function sampleMean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return sum(xs) / xs.length;
}

/** Unbiased sample variance (Bessel's n-1 correction), fixed summation order. */
export function sampleVariance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = sampleMean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i] - m;
    s += d * d;
  }
  return s / (n - 1);
}
