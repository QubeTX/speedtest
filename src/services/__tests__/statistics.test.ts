/**
 * Golden-vector + ground-truth tests for the SpeedQX Methodology v4 core.
 *
 * Two layers of assertion:
 *   1. GROUND TRUTH — hand-computed literals (quantile of known arrays, PCG32
 *      first outputs cross-checked independently, invNormal/phi at known points,
 *      trimean/HL/bufferbloat boundaries). These anchor the implementation to
 *      external truth, not just to itself.
 *   2. REGRESSION — every value in golden-vectors.json is recomputed from the
 *      implementation and compared. Arithmetic paths are asserted BIT-EXACT
 *      (`toBe`); the transcendental paths (invNormal / BCa / EB-CS, via log/sqrt/
 *      exp) are asserted to 1e-9 relative, matching the portability contract that
 *      the Rust CLI port will also honor.
 *
 * The fixture is read from disk (not imported) so it stays outside tsconfig's
 * `src` rootDir without tripping module resolution.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  quantile,
  invNormal,
  phi,
  t975,
  T975_TABLE,
  sum,
  sampleMean,
  sampleVariance,
  lemireBounded,
  PCG32,
  PCG32_DEFAULT_STATE,
  PCG32_DEFAULT_INC,
} from '../stat-primitives';
import {
  plateauStart,
  hodgesLehmann,
  circularBlockBootstrap,
  modifiedTrimean,
  filterOutliersIQR,
  mergeProviders,
  jitterMetrics,
  pdv,
  ipdvMean,
  medianAbsoluteDeviation,
  bufferbloatDelta,
  bufferbloatGrade,
  rpm,
  empiricalBernsteinCS,
} from '../statistics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const golden: any = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../golden-vectors.json'), 'utf8'),
);

/** Relative-tolerance assertion for transcendental paths. */
function expectRelClose(actual: number, expected: number, tol = 1e-9): void {
  const denom = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected) / denom).toBeLessThanOrEqual(tol);
}

// ─────────────────────────────────────────────────────────────────────────
describe('quantile (type-7, bit-exact)', () => {
  it('matches hand-computed values', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
    expect(quantile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.1)).toBe(19);
    expect(quantile([5, 5, 5, 5], 0.42)).toBe(5);
  });
  it('single element and empty', () => {
    expect(quantile([7], 0.5)).toBe(7);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });
  it('matches golden cases bit-exactly', () => {
    for (const c of golden.quantile) {
      expect(quantile(c.sorted, c.p)).toBe(c.expected);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('PCG32 + Lemire bounded (bit-exact)', () => {
  it('first 4 u32s match the independently cross-checked reference', () => {
    const r = new PCG32();
    expect([r.nextU32(), r.nextU32(), r.nextU32(), r.nextU32()]).toEqual([
      355248013, 41705475, 3406281715, 4186697710,
    ]);
  });
  it('uses the pinned default initializer', () => {
    expect(PCG32_DEFAULT_STATE).toBe(0x853c49e6748fea9bn);
    expect(PCG32_DEFAULT_INC).toBe(0xda3e39cb94b95bdbn);
  });
  it('first 64 u32s match golden and stay in u32 range', () => {
    const r = new PCG32();
    const out = Array.from({ length: 64 }, () => r.nextU32());
    expect(out).toEqual(golden.pcg32.first64U32);
    for (const v of out) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });
  it('is deterministic — two fresh generators agree', () => {
    const a = new PCG32();
    const b = new PCG32();
    for (let i = 0; i < 20; i++) expect(a.nextU32()).toBe(b.nextU32());
  });
  it('bounded index streams match golden and stay in [0, n)', () => {
    for (const n of [12, 27, 60, 200]) {
      const r = new PCG32();
      const stream = Array.from({ length: 32 }, () => r.boundedIndex(n));
      expect(stream).toEqual(golden.pcg32.bounded[String(n)]);
      for (const v of stream) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(n);
      }
    }
  });
  it('lemireBounded is floor(u32 * n / 2^32)', () => {
    expect(lemireBounded(0, 100)).toBe(0);
    expect(lemireBounded(0xffffffff, 100)).toBe(99);
    expect(lemireBounded(0x80000000, 10)).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('invNormal + phi (1e-9 relative)', () => {
  it('invNormal at known quantiles', () => {
    // Acklam's max relative error (~1.15e-9) is vs the TRUE quantile, so these
    // external-truth anchors use 1e-8. The strict 1e-9 same-algorithm contract is
    // exercised by the golden BCa checks.
    expect(invNormal(0.5)).toBe(0);
    expectRelClose(invNormal(0.975), 1.959963984540054, 1e-8);
    expectRelClose(invNormal(0.025), -1.959963984540054, 1e-8);
    expectRelClose(invNormal(0.99), 2.3263478740408408, 1e-8);
    expectRelClose(invNormal(0.841344746068543), 1.0, 1e-6); // ~1 sigma
  });
  it('invNormal boundaries', () => {
    expect(invNormal(0)).toBe(-Infinity);
    expect(invNormal(1)).toBe(Infinity);
  });
  it('phi at known points', () => {
    expect(phi(0)).toBe(0.5);
    expectRelClose(phi(1.959963984540054), 0.975);
    expectRelClose(phi(-1.959963984540054), 0.025);
    expectRelClose(phi(1) + phi(-1), 1, 1e-12);
  });
  it('phi ∘ invNormal round-trips', () => {
    for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
      expectRelClose(phi(invNormal(p)), p, 1e-8);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('t975 table', () => {
  it('matches the pinned table', () => {
    expect(t975(1)).toBe(12.706);
    expect(t975(2)).toBe(4.303);
    expect(t975(3)).toBe(3.182);
    expect(t975(4)).toBe(2.776);
    expect(t975(5)).toBe(2.571);
    expect(t975(6)).toBe(2.447);
    expect(t975(7)).toBe(2.365);
    expect(T975_TABLE[2]).toBe(4.303);
  });
  it('clamps df below 1 and above 7', () => {
    expect(t975(0)).toBe(12.706);
    expect(t975(8)).toBe(2.365);
    expect(t975(99)).toBe(2.365);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('fixed-order sum helpers', () => {
  it('sum / mean / variance on a known array', () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(sum(xs)).toBe(40);
    expect(sampleMean(xs)).toBe(5);
    // population var is 4; sample var (n-1) = 32/7
    expect(sampleVariance(xs)).toBe(32 / 7);
  });
  it('degenerate lengths', () => {
    expect(sum([])).toBe(0);
    expect(sampleMean([])).toBe(0);
    expect(sampleVariance([3])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('modifiedTrimean / IQR / Hodges–Lehmann (bit-exact)', () => {
  it('modifiedTrimean of a linear ramp', () => {
    // P10=19, P50=55, P90=91 → (19 + 8*55 + 91)/10 = 55
    expect(modifiedTrimean([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])).toBe(55);
  });
  it('filterOutliersIQR removes a spike', () => {
    const cleaned = filterOutliersIQR([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 1.5);
    expect(cleaned).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('filterOutliersIQR is a no-op below n=4', () => {
    expect(filterOutliersIQR([1, 100, 2], 1.5)).toEqual([1, 100, 2]);
  });
  it('hodgesLehmann via Walsh averages', () => {
    // Walsh averages of [1,2,3] sorted: [1,1.5,2,2,2.5,3] → median 2
    expect(hodgesLehmann([1, 2, 3])).toBe(2);
    expect(hodgesLehmann([5])).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('plateauStart', () => {
  it('all-equal series clamps to the 10% floor', () => {
    expect(plateauStart([5, 5, 5, 5, 5, 5, 5, 5])).toBe(1); // clamp(0, ceil(0.8)=1, floor(3.2)=3)
  });
  it('small series uses the 30% fallback', () => {
    expect(plateauStart([1, 2, 3, 4, 5])).toBe(Math.ceil(0.3 * 5)); // n<8 → ceil(1.5)=2
  });
  it('matches golden per input size', () => {
    for (const n of [12, 27, 60, 200]) {
      expect(plateauStart(golden.samples[String(n)])).toBe(golden.perProvider[String(n)].plateauStart);
    }
  });
  it('always returns an index inside [ceil(0.1n), floor(0.4n)] for n>=8', () => {
    for (const n of [12, 27, 60, 200]) {
      const raw = golden.samples[String(n)];
      const ps = plateauStart(raw);
      expect(ps).toBeGreaterThanOrEqual(Math.ceil(0.1 * n));
      expect(ps).toBeLessThanOrEqual(Math.floor(0.4 * n));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('per-provider pipeline vs golden', () => {
  for (const n of [12, 27, 60, 200]) {
    it(`n=${n}: plateau → IQR → trimean/HL bit-exact`, () => {
      const raw = golden.samples[String(n)];
      const g = golden.perProvider[String(n)];
      const cleaned = filterOutliersIQR(raw.slice(plateauStart(raw)), 1.5);
      expect(cleaned).toEqual(g.cleaned);
      expect(modifiedTrimean(cleaned)).toBe(g.trimean);
      expect(hodgesLehmann(cleaned)).toBe(g.hodgesLehmann);
    });

    it(`n=${n}: circular block bootstrap + BCa`, { timeout: 30000 }, () => {
      const raw = golden.samples[String(n)];
      const g = golden.perProvider[String(n)];
      const boot = circularBlockBootstrap(filterOutliersIQR(raw.slice(plateauStart(raw)), 1.5), new PCG32(), 2000);
      // Block length + resample distribution: bit-exact (arithmetic + deterministic PRNG).
      expect(boot.blockLength).toBe(g.bootstrap.blockLength);
      expect(boot.thetaHat).toBe(g.bootstrap.thetaHat);
      expect(boot.thetaStarMean).toBe(g.bootstrap.thetaStarMean);
      expect(boot.variance).toBe(g.bootstrap.variance);
      // BCa bounds: transcendental (invNormal/phi) → 1e-9 relative.
      expectRelClose(boot.ciLower, g.bootstrap.ciLower);
      expectRelClose(boot.ciUpper, g.bootstrap.ciUpper);
    });
  }

  it('bootstrap is deterministic across repeated runs', () => {
    const raw = golden.samples['27'];
    const cleaned = filterOutliersIQR(raw.slice(plateauStart(raw)), 1.5);
    const a = circularBlockBootstrap(cleaned, new PCG32(), 500);
    const b = circularBlockBootstrap(cleaned, new PCG32(), 500);
    expect(a.thetaStarMean).toBe(b.thetaStarMean);
    expect(a.variance).toBe(b.variance);
    expect(a.ciLower).toBe(b.ciLower);
    expect(a.ciUpper).toBe(b.ciUpper);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('cross-provider merge vs golden', () => {
  for (let i = 0; i < 5; i++) {
    it(`merge case: ${['k3-high', 'k2-union', 'k4-unknown', 'k1-passthrough', 'k3-equal'][i]}`, () => {
      const c = golden.merge[i];
      const r = mergeProviders(c.providers);
      const e = c.expected;
      expect(r.k).toBe(e.k);
      expect(r.capacity).toBe(e.capacity);
      expect(r.consensus).toBe(e.consensus);
      expect(r.tau2).toBe(e.tau2);
      expect(r.i2).toBe(e.i2);
      expect(r.q).toBe(e.q);
      expect(r.band).toBe(e.band);
      expect(r.tier).toEqual(e.tier);
      expect(r.exclusions).toEqual(e.exclusions);
      expect(r.capacityCi.lower).toBe(e.capacityCi.lower);
      expect(r.capacityCi.upper).toBe(e.capacityCi.upper);
      expect(r.consensusCi.lower).toBe(e.consensusCi.lower);
      expect(r.consensusCi.upper).toBe(e.consensusCi.upper);
    });
  }

  it('k=1 passes the provider BCa through verbatim', () => {
    const r = mergeProviders([
      { name: 'cloudflare', y: 615, v: 18, samples: 33, bca: { lower: 590, upper: 640 } },
      { name: 'ndt7', y: 600, v: 40, samples: 2 },
    ]);
    expect(r.k).toBe(1);
    expect(r.capacity).toBe(615);
    expect(r.consensus).toBe(615);
    expect(r.capacityCi).toEqual({ lower: 590, upper: 640 });
    expect(r.exclusions).toEqual([{ name: 'ndt7', samples: 2 }]);
    expect(r.band).toBe('insufficient');
  });

  it('k=2 reports the union band and insufficient agreement', () => {
    const r = mergeProviders([
      { name: 'cloudflare', y: 500, v: 30, samples: 36 },
      { name: 'ndt7', y: 420, v: 50, samples: 24 },
    ]);
    expect(r.k).toBe(2);
    expect(r.band).toBe('insufficient');
    expect(r.consensusCi.lower).toBeCloseTo(Math.min(500 - 1.96 * Math.sqrt(30), 420 - 1.96 * Math.sqrt(50)), 9);
    expect(r.capacityCi).toEqual(r.consensusCi);
  });

  it('identical providers → zero heterogeneity, high agreement', () => {
    const r = mergeProviders([
      { name: 'cloudflare', y: 500, v: 10, samples: 20 },
      { name: 'msak', y: 500, v: 10, samples: 20 },
      { name: 'ndt7', y: 500, v: 10, samples: 20 },
    ]);
    expect(r.tau2).toBe(0);
    expect(r.i2).toBe(0);
    expect(r.band).toBe('high');
    expect(r.capacity).toBeCloseTo(500, 9);
  });

  it('unknown-variance provider is assigned the max known variance', () => {
    const r = mergeProviders([
      { name: 'cloudflare', y: 950, v: 20, samples: 40 },
      { name: 'librespeed', y: 930, v: NaN, samples: 30 },
      { name: 'ndt7', y: 610, v: 80, samples: 25 },
    ]);
    const libre = r.weights.find((w) => w.name === 'librespeed')!;
    expect(libre.v).toBe(80); // max known variance
  });

  it('empty qualifying set yields an insufficient empty result', () => {
    const r = mergeProviders([{ name: 'cloudflare', y: 500, v: 10, samples: 2 }]);
    expect(r.k).toBe(0);
    expect(r.capacity).toBe(0);
    expect(r.band).toBe('insufficient');
    expect(r.exclusions).toEqual([{ name: 'cloudflare', samples: 2 }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('jitter (PDV / IPDV / MAD) vs golden', () => {
  it('recomputes golden jitter metrics bit-exactly', () => {
    const s = golden.jitter.samples;
    const m = jitterMetrics(s);
    expect(m.pdv).toBe(golden.jitter.pdv);
    expect(m.ipdvMean).toBe(golden.jitter.ipdvMean);
    expect(m.mad).toBe(golden.jitter.mad);
    expect(m.jitterRfc3550).toBe(golden.jitter.jitterRfc3550);
  });
  it('pdv = P95 − P50', () => {
    expect(pdv([10, 10, 10, 10, 10])).toBe(0);
    // sorted [1..11], P50=6, P95: h=9.5 → 10+0.5=10.5 → pdv 4.5
    expect(pdv([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(4.5);
  });
  it('ipdvMean and MAD basics', () => {
    expect(ipdvMean([5, 5, 5])).toBe(0);
    expect(ipdvMean([1, 3, 2])).toBe((2 + 1) / 2);
    expect(medianAbsoluteDeviation([1, 1, 1, 1])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('bufferbloat + RPM vs golden', () => {
  it('recomputes golden delta/ratio/grade/rpm bit-exactly', () => {
    const bb = bufferbloatDelta(golden.bufferbloat.idle, golden.bufferbloat.loaded);
    expect(bb.deltaMs).toBe(golden.bufferbloat.deltaMs);
    expect(bb.ratio).toBe(golden.bufferbloat.ratio);
    expect(bb.grade).toBe(golden.bufferbloat.grade);
    expect(rpm(golden.bufferbloat.loaded)).toBe(golden.bufferbloat.rpm);
  });
  it('grade thresholds A+ <5 · A <30 · B <60 · C <200 · D <400 · F', () => {
    expect(bufferbloatGrade(4.999)).toBe('A+');
    expect(bufferbloatGrade(5)).toBe('A');
    expect(bufferbloatGrade(29.999)).toBe('A');
    expect(bufferbloatGrade(30)).toBe('B');
    expect(bufferbloatGrade(59.999)).toBe('B');
    expect(bufferbloatGrade(60)).toBe('C');
    expect(bufferbloatGrade(199.999)).toBe('C');
    expect(bufferbloatGrade(200)).toBe('D');
    expect(bufferbloatGrade(399.999)).toBe('D');
    expect(bufferbloatGrade(400)).toBe('F');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('empirical-Bernstein confidence sequence', () => {
  it('recomputes golden CS widths (1e-9 relative) and stop flags', () => {
    const src = golden.samples['60'];
    for (const t of [12, 25, 50]) {
      const cs = empiricalBernsteinCS(src.slice(0, t));
      const g = golden.ebcs[String(t)];
      expect(cs.t).toBe(g.t);
      expectRelClose(cs.U, g.U);
      expectRelClose(cs.muHatMbps, g.muHatMbps);
      expectRelClose(cs.halfWidthMbps, g.halfWidthMbps);
      expectRelClose(cs.width, g.width);
      expect(cs.stop).toBe(g.stop);
    }
  });
  it('does not stop before t=12', () => {
    const cs = empiricalBernsteinCS(Array(11).fill(500));
    expect(cs.stop).toBe(false);
  });
  it('stops once a long, tight, converged series is inside the band', () => {
    const cs = empiricalBernsteinCS(Array(600).fill(500));
    expect(cs.stop).toBe(true);
  });
  it('RTT gate (>50 ms) disables early stop even when converged', () => {
    const cs = empiricalBernsteinCS(Array(600).fill(500), { minRttMs: 60 });
    expect(cs.stop).toBe(false);
  });
  it('empty and zero-max inputs are safe', () => {
    expect(empiricalBernsteinCS([]).stop).toBe(false);
    expect(empiricalBernsteinCS([0, 0, 0]).stop).toBe(false);
  });
});
