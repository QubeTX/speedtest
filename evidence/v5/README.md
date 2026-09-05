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

- Complete counter-trace replay compares all estimate fields and both primary aggregations across Rust and TypeScript. All 88 synthetic, real Cloudflare and packet-shaped traces agree after the ceiling correction. Separate cases verify repeated-provider and cross-provider aggregation with missing ceiling evidence. Across 14 analytical scenarios, v4's point estimator has 24.88% mean absolute error and v5 has zero arithmetic error. This establishes estimator correctness on those traces, not physical network accuracy.
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

Local candidate checks: website 87 tests and production build; app 38 tests, TypeScript, documentation validation, Expo Doctor 20/20 and both native exports; Rust 332 tests, strict Clippy, release build and dependency audit; homepage documentation lint/build. Exact committed-source CI and final export checks must be attached before release.

Expo built candidate iOS simulator and Android emulator binaries successfully. Native UI testing is in progress. Initial failures exposed an unavailable simulator name, deep-link startup/confirmation timing, outdated screenshot output paths and selectors that did not match accessible labels. Their failures are retained in the task record; no failed suite is counted as a pass. Physical iOS/Android acceptance remains open.

## Remaining release gates

- [ ] Final correction pins and hosted checks. The prior candidate passed Rust platform, app/web CI and native installer lifecycle checks; the newest ceiling correction requires its own final checks.
- [ ] Successful native simulator/emulator journeys, reviewed screenshots and recordings at the final candidate.
- [ ] Physical iOS/Android layout, large text, reduced motion, cancellation and animation performance.
- [ ] Packet-shaped loss/reference coverage and matched real-provider runs.
- [ ] Physical/device animation overhead; browser proof is scoped above.
- [ ] CLI package, installer/release checks and production verification.
- [ ] Push/merge/deploy and new Expo store build/upload. App Store review submission stays with the user.

## Reproduction

Start the website development server on port 5175. Install locked dependencies in the relevant repository. Build the Rust `v5-replay` and `v5-acquire` examples. The example acquisition executable accepts loopback endpoints, plus exact TEST-NET-1 address 192.0.2.2 only with the isolated-reference environment opt-in. Run from the website repository:

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

## Isolated packet impairment candidate

`run-netem-reference.sh` creates two disposable Linux network namespaces with a veth pair and no default routes. Segmentation/offload is disabled. Netem acts on each receiver ingress through an IFB, as required for realistic TCP queue behavior. Its hosted workflow compares two order-alternating browser/Rust repetitions on clean, asymmetric, high-latency and lossy paths, plus the original v4 Cloudflare acquisition. The workflow pins the Rust harness revision and retains queue statistics and traces.

Configured transport limits include protocol overhead. Under loss and queuing, server write timestamps precede delivery and upload receipt timestamps precede client acknowledgement, so these records cannot support timestamp-exact absolute error claims. This experiment extends impairment coverage; it does not replace delivered-payload, physical-device or real-provider acceptance. Hosted run 33942969873 passed its acquisition-integrity checks and retained 40 records (32 v5 transfers and eight original-v4 runs). `netem-before-client-reset.json` and its comparison file retain the evidence. Inspection found the browser reused its connection pool between directional transfers while the standalone Rust example created a fresh pool; a follow-up resets both clients and increases the repetitions to three. Clean/asymmetric download pairs differed by less than 0.05%; clean/asymmetric upload pairs by less than 1.8%. Under 150 ms added round-trip delay, one upload pair differed by about 14.8%; the two-pair median was about 7.7%, above the 5% target. Random packet loss produced still larger differences. The affected two-stream, short-request upload schedule and random loss sensitivity need further qualification; these runs are not marked as satisfying the full accuracy/repeatability release gate. Original v4 failed to establish upload results under the latency/loss cases, while v5 retained measured partial-direction evidence.

### Fresh-client follow-up and real-path recordings

[Hosted run 33943631436](https://github.com/QubeTX/speedtest/actions/runs/33943631436) records three order-alternating repetitions with fresh browser and Rust connection pools. The raw 60 records are in `netem-fresh-clients.json.gz`; the comparison file includes the uncompressed SHA-256, exact checkout revisions, pair values and within-surface variation. Acquisition integrity passed. The 5% paired median target was met in six of eight scenario/direction combinations:

| Packet-shaped condition | Median download difference | Median upload difference |
|---|---:|---:|
| Clean 20/20 Mbps | 0.006% | 1.30% |
| Asymmetric 40/5 Mbps | 0.002% | 2.57% |
| 150 ms added RTT | 0.016% | 3.47% |
| Random 0.5% loss, 80 ms added RTT | **32.79%** | **10.80%** |

Loss is independently randomized for each transfer, so these are not identical packet-loss histories. Within-surface download coefficients of variation are 21.6% in Chrome and 25.1% in Rust; upload is about 8.0% in each. The three-run average uploads are 3.355 and 3.360 Mbps, yet individual pairs differ materially. These observations point to short-run TCP/loss variability as a contributor; they do not prove equivalence or satisfy the loss repeatability target. The first experiment and all failed target results remain retained. No scheduler or estimator is tuned to erase these differences. Original v4 provides no usable upload in all three high-latency runs and two of three lossy runs; that is availability evidence, not proof of absolute accuracy.

`live-cloudflare.json` retains three sequential, order-alternating Quick/Cloudflare-only pairs on one Windows host, each capped at 500 MB. All completed normally. Median differences were 2.20% download and **11.13% upload**, with one upload pair differing by 48.87%. Actual host/network conditions were uncontrolled; this smoke proves provider operation and partial evidence collection, not a 5% general result. M-Lab consent was declined, so no public M-Lab measurement was performed.

The first live trace exposed a ceiling below sustained throughput (154.27 versus 159.68 Mbps). The corrected Rust/TypeScript estimators withhold such a candidate at trace, repeated-provider and headline levels. They never raise it artificially. The recorded old outputs remain unchanged; all recorded counters are replayed through the corrected engines, with 88 full-trace comparisons and explicit ceiling regressions. Sustained byte/time calculation and acquisition are unchanged by this correction.

For an explicitly requested public-path rerun, `SPEEDQX_LIVE=1 node scripts/validate-live-cloudflare.mjs` runs three sequential Cloudflare-only pairs against the local website development server and release CLI. Each of six runs is capped at 500 MB. The script refuses an existing output file and keeps M-Lab declined. The archived original recording is never overwritten. This opt-in script was syntax checked after organizing the original smoke procedure; no extra public transfers were performed.
