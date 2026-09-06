# SpeedQX

A responsive cassette instrument for network measurement, built with React and TypeScript. Live at [speedqx.com](https://speedqx.com).

Makira and Gail Rock typography, soft neutral surfaces and grouped readings connect the website to the iPhone app. The cassette follows the original iOS silhouette: a rounded blue-gray body, one darker window and two prominent reels. Restrained geometry and a broad black transport control keep the web instrument simple and recognizable.

## Measurement

SpeedQX measures sustained application throughput on the device and paths tested. Methodology v5 uses monotonic byte counters, a fixed two-second warm-up, and the median of qualifying Cloudflare and M-Lab MSAK primary estimates. NDT7 remains a separate single-stream comparison. A repeatable ceiling needs two non-overlapping three-second windows within 10%; it does not describe the ISP's physical line capacity.

Quick is the default, capped at 90 seconds and 5 GB of payload budget. Deep repeats the primary comparison with longer transfers, adds supplementary results, and is capped at five minutes and 20 GB. Both can use a smaller byte ceiling. M-Lab requires explicit consent to publication of measurement results and IP addresses. Without consent, the headline is labeled single-source. HTTP ping is the median idle RTT to the common Cloudflare reference; download-loaded and upload-loaded latency and HTTP failures are separate details. No nominal 95% accuracy claim or UDP loss estimate is inferred.

Stop preserves valid partial results. Background and detected network transitions stop comparable collection. The result shows confirmed payload, conservative budget usage, elapsed time, source evidence and chronological traces. The cassette spins only when transfer bytes arrive; startup uses a probe indicator. Reduced motion is supported.

The [methodology](METHODOLOGY.md) defines the versioned result contract. [Historical v4 documentation](docs/METHODOLOGY-v4.md) preserves older result meanings. [Validation evidence](evidence/v5) distinguishes deterministic replay, paced loopback acquisition, browser rendering and remaining device acceptance.

## Development

```sh
npm ci
npm test
npm run build
npm run dev
```

Vercel builds the production site from `main`. GitHub Actions validates tests, the production bundle and high-severity dependency advisories. Existing edge functions under `api/` provide provider discovery and the historical TURN credential endpoint; v5 adds no measurement servers.

## Shared engine

- `src/services/measurement-contract-v5.json`: profiles, units and protocol limits.
- `src/services/measurement-v5.ts`: counter interpretation, sustained estimates, repeatable windows and primary aggregation.
- `src/services/acquisition-v5.ts`: bounded HTTP and receiver-accounted M-Lab WebSockets.
- `src/services/engine-v5.ts`: schedule, reference latency, consent, lifecycle and result assembly.
- `src/services/methodology-guide-v5.json`: shared product explanation text.
- `src/components/mechanism/`: shared vector cassette and area-conserving geometry.

The Expo app generates a pinned copy with SHA-256 verification. Rust implements the same contract independently and replays complete traces against this engine. Legacy v4 providers and statistics remain as historical/reference code; the product factory selects v5.

## Validation tools

`npm exec vite-node scripts/validate-v5.ts` compares TypeScript with the Rust `v5-replay` example. `scripts/validate-transport.mjs` drives the production HTTP adapter against an independently paced loopback fixture; it never deploys a server. `scripts/validate-app-lifecycle.mjs` checks the Expo browser's live engine through stop/restart during latency, download and upload. See their evidence and limitations before making accuracy claims.

Built by [QubeTX](https://qubetx.com), a department of ES Development LLC.
