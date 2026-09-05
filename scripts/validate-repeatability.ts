// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { writeFileSync } from 'node:fs';
import { estimateTrace, type MeasurementTrace } from '../src/services/measurement-v5';

// Coverage experiment, not a nominal confidence test. Hold out the next three
// seconds and ask whether its actual average is inside the observed run range.
let seed = 7319;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
const experiments = [];
for (const [name, rho, transition] of [['stationary', 0, false], ['correlated', .9, false], ['strongly-correlated', .99, false], ['network-regime-change', .9, true]] as const) {
  let covered = 0, available = 0;
  for (let run = 0; run < 1000; run++) {
    let rate = 60 + 10 * gaussian(), bytes = 0;
    const points = [{ t: 0, bytes: 0 }];
    for (let i = 1; i <= 20; i++) {
      rate = Math.max(0, 60 + rho * (rate - 60) + Math.sqrt(1 - rho * rho) * 10 * gaussian());
      bytes += Math.round(rate * 500 / .008); points.push({ t: i * 500, bytes });
    }
    const trace: MeasurementTrace = { provider: 'cloudflare', endpoint: 'https://reference.invalid', direction: 'download', transport: 'https', streams: 2, accounting: 'received', warmupMs: 2000, points, stopReason: 'complete' };
    const range = estimateTrace(trace).repeatability;
    let future = 0;
    for (let i = 0; i < 6; i++) {
      const center = transition ? 100 : 60;
      rate = Math.max(0, center + rho * (rate - center) + Math.sqrt(1 - rho * rho) * 10 * gaussian());
      future += rate / 6;
    }
    if (range) { available++; if (future >= range.lower && future <= range.upper) covered++; }
  }
  experiments.push({ name, autocorrelation: rho, regimeChangeAfterMeasurement: transition, runs: 1000, available, covered, observedCoveragePct: covered / available * 100 });
}
const report = { kind: 'Deterministic held-out repeatability experiment', assumptions: 'Seeded Gaussian AR(1) rates in half-second intervals; 10-second measurement with a 2-second warm-up, followed by a held-out 3-second average. A simple synthetic family, not an empirical guarantee for physical networks.', interpretation: 'Observed window ranges are descriptive. Their predictive coverage depends strongly on correlation and changing conditions. No nominal 95% confidence claim is justified by this experiment.', experiments };
writeFileSync('evidence/v5/repeatability-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
