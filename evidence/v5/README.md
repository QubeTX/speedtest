# SpeedQX v5 candidate validation

Status: implementation candidate. This report separates completed checks from open release gates. Nothing here certifies physical-device accuracy or authorizes skipping an open acceptance check.

## Independently paced HTTP acquisition

The loopback fixture shares a payload pacer across both transfer lanes and records delivered payload independently of the clients. Browser and Rust runs are sequential, with matching profiles and endpoints. Error compares client accounting with server records aligned to the measured time window. The configured ceiling is reported separately; request overhead can make achieved throughput lower.

| Browser paired with Rust | Directional runs | Mean absolute accounting error | Largest error | Largest paired difference |
| --- | ---: | ---: | ---: | ---: |
| chromium | 20 | 0.71% | 3.06% | 3.82% |
| firefox | 20 | 0.57% | 2.60% | 3.73% |
| webkit | 20 | 0.60% | 1.64% | 3.65% |

The five scenarios are 20 Mbps stable, 40/5 Mbps asymmetric, 150 ms request delay, 4/36 Mbps alternating bursts, and periodic one-second stalls. Every final paired difference is below 5% in these matrices. They are single pairs per scenario, not a general repeatability guarantee. Raw chronology and provider metadata are retained in `transport-*-final.json` and `transport-webkit.json`.

A Firefox asymmetric-upload regression was reproduced before bounding request growth. The initial fast acknowledgement caused an oversized request to straddle warm-up; limiting growth to 2x fixed that case. The failed evidence remains in `regression-firefox-before-growth-limit.json`, with three repeated repaired pairs in `transport-firefox-growth-limit.json`.

**High RTT remains a transport limitation:** the 20 Mbps fixture delivers roughly 14–15 Mbps during 250 ms acknowledged HTTP upload requests. V5 accurately reports that achieved application throughput; it cannot infer the physical line ceiling. The ceiling rule cannot recover a speed the transport never demonstrated.

## Comparison with v4

Two different comparisons are kept distinct:

- Complete counter-trace replay compares all estimate fields and both primary aggregations across Rust and TypeScript. All 26 traces agree. Across 14 analytical scenarios, v4's point estimator has 24.88% mean absolute error and v5 has zero arithmetic error. This establishes estimator correctness on those traces, not physical network accuracy.
- `v4-acquisition-chromium.json` and `v4-acquisition-firefox.json` run the retained, unchanged v4 Quick Cloudflare provider and its original SDK, scheduler, buffering and aggregation. Fetch destinations and matching Resource Timing lookups are redirected to the fixture. M-Lab consent is declined, isolating the common Cloudflare baseline. This is an actual legacy acquisition comparison, not a replay of v5 samples.

On the stable 20 Mbps path, the original transport reports approximately 19.9–20.7 Mbps download and 20.3–20.4 Mbps upload. On 40/5 Mbps, it reports approximately 32.0–33.6 Mbps download and 5.1 Mbps upload. With the 150 ms request delay, its 25-second provider cap produces approximately 4.6 Mbps download and no usable upload. Some stalled runs also reach that cap before upload. Full raw progress and independent server records are retained; unavailable upload is not treated as a measured zero. Bursty/stalled paths have no single fixed configured rate, so no constant-capacity error is asserted for them.

V5 lowers aggregate error in the recorded estimator and transport comparisons, while preserving valid partial evidence instead of claiming unmeasured directions. Actual M-Lab paths and packet-shaped references remain independent gates.

## Animation and interaction

`animation-impact-browser.json` records 32 runs, forming 16 alternating animation-on/off pairs at normal and 4x CPU throttling. It mounts the production cassette and receives live throughput updates from the real HTTP collector. The largest positive per-pair regression is 0.33% (rounded upward); per-condition median regressions range from -0.16% to +0.08%, below the 2% target. This evidence applies to the paced 20 Mbps browser fixture, not native phones or all link speeds.

`app-live-lifecycle.json` exercises the actual Expo hook and DOM bridge against the independent fixture. Stop, partial-result delivery, reset, immediate restart, stale-callback protection, initial probe feedback and reel movement pass during latency, download and upload with no page errors. Browser-specific tabs remove the unsupported expo-font image-rendering call. Per-run wake-lock leases prevent a late/duplicate asynchronous release from breaking Stop or a subsequent run.

`web-ui.json` and the associated screenshots exercise actual website completion, stop/reset, trace details, metric explanations, settings, responsive widths and reduced motion in Chrome, Firefox and WebKit. Browser preview does not replace native acceptance.

## Honest uncertainty

`repeatability-coverage.json` holds out the next three-second average in four seeded 1,000-run experiments. The observed window range covers 63.6% under the independent stationary fixture, 35.8% at correlation 0.9, 35.0% at correlation 0.99, and 19.5% after a regime change. These descriptive ranges cannot support a 95% predictive claim. The product labels them as observed windows/provider spread, discloses their assumptions, and makes no calibrated coverage promise.

## Build and native acceptance

Local candidate checks: website 87 tests and production build; app 37 tests, TypeScript, documentation validation, Expo Doctor 20/20 and both native exports; Rust 332 tests, strict Clippy, release build and dependency audit; homepage documentation lint/build. Exact committed-source CI and final export checks must be attached before release.

Expo built candidate iOS simulator and Android emulator binaries successfully. Native UI testing is in progress. Initial failures exposed an unavailable simulator name, deep-link startup/confirmation timing, outdated screenshot output paths and selectors that did not match accessible labels. Their failures are retained in the task record; no failed suite is counted as a pass. Physical iOS/Android acceptance remains open.

## Remaining release gates

- [ ] Exact committed-source pins, hosted Rust platform CI and app/web CI.
- [ ] Successful native simulator/emulator journeys, reviewed screenshots and recordings at the final candidate.
- [ ] Physical iOS/Android layout, large text, reduced motion, cancellation and animation performance.
- [ ] Packet-shaped loss/reference coverage and matched real-provider runs.
- [ ] Physical/device animation overhead; browser proof is scoped above.
- [ ] CLI package, installer/release checks and production verification.
- [ ] Push/merge/deploy and new Expo store build/upload. App Store review submission stays with the user.

## Reproduction

Start the website development server on port 5175. Install locked dependencies in the relevant repository. Build the Rust `v5-replay` and `v5-acquire` examples. The example acquisition executable accepts loopback endpoints only. Run from the website repository:

```sh
npx --no-install vite-node scripts/validate-v5.ts
npx --no-install vite-node scripts/validate-repeatability.ts
node scripts/validate-transport.mjs
node scripts/validate-v4-transport.mjs
node scripts/validate-animation-impact.mjs
node scripts/validate-web-ui.mjs
node scripts/validate-app-lifecycle.mjs
```

The app lifecycle fixture additionally requires the Expo browser server on port 8082. `BROWSER=firefox|webkit`, `SCENARIOS`, `REPEATS`, and `REPORT_SUFFIX` select transport runs. Use `SPEEDQX_REPLAY`/`SPEEDQX_ACQUIRE` to select non-Windows example paths. Do not run multiple measurement benchmarks concurrently. Fixture code is local validation infrastructure and is not deployed as a production measurement service.
