# Technical Accuracy Report

## SpeedQX (QubeTX Speed Test) — Measurement Methodology & Architecture

How the SpeedQX website measures internet connection quality. This is the engineering
companion to **[METHODOLOGY.md](./METHODOLOGY.md)** — the canonical, versioned
cross-product specification (methodology **4.0**) shared byte-identically with the
SpeedQX iOS app and the `speedqx` CLI. Where this document summarizes, METHODOLOGY.md
is exact; every constant here is pinned there.

---

## Architecture

A browser-based React + TypeScript instrument with a **multi-provider, multi-phase**
design. Every result payload carries `methodologyVersion: "4.0"` so it self-identifies
the algorithm that produced it.

```
Test flow
  1. Idle latency        dedicated HTTP probe engine (50–200 pings, 3-probe warmup)
  2. Providers           run sequentially, each: download → upload (+ loaded-latency
                         probes during Cloudflare saturation)
  3. Aggregation         per-provider robust pipeline → cross-provider hybrid merge
```

Two test modes, chosen at the deck:

| Mode | Sources | Duration | Early stop |
|---|---|---|---|
| **FAST** | Cloudflare + M-Lab NDT7 + M-Lab MSAK | ~1 min | anytime-valid confidence sequence |
| **FULL** | every browser-capable source (7) | fixed durations | none |

## Measurement sources

| Source | Transport | Notes |
|---|---|---|
| Cloudflare | HTTPS ladder to 250 MB | loaded latency, packet loss (Realtime TURN), AIM |
| M-Lab NDT7 | single-stream WebSocket | kernel `TCPInfo.MinRTT`; the single-flow reference |
| M-Lab MSAK | 2-stream WebSocket | multi-stream M-Lab measurement |
| LibreSpeed | HTTPS (CORS-verified backends) | community backend rotation |
| fast.com | HTTPS to Netflix OCA nodes | labeled *estimate* (token relay); hides on failure |
| CacheFly | HTTPS range requests (1/10/100 MB) | download-only anycast CDN |
| Vultr | HTTPS range requests, 8 POPs | download-only; min-RTT POP selection |
| Apple networkQuality | — | **CLI-only** (browser CORS); shown greyed, never silently missing |

Sources that can't run on a platform appear in results as `unavailable-platform`;
failed sources degrade to `failed` and the merge continues — numbers are never fabricated.

## Per-source pipeline

For each source and direction (exact formulas: METHODOLOGY.md §5):

1. Dense throughput sampling (250–500 ms ticks; ~2 s adaptive request sizing).
2. **Plateau detection** — warm-up ends where 3 consecutive samples sit within ±10%
   of the forward median (clamped 10–40%). Replaces fixed slow-start discards.
3. IQR outlier filter (k = 1.5); uploads additionally keep the fastest 50%.
4. **Modified trimean** `(P10 + 8·P50 + P90)/10` — the same statistic used by Ookla's
   Speed Score — with a Hodges–Lehmann cross-check.
5. **Circular block bootstrap** (block ≈ n^⅓, B = 2000) with **BCa** 95% intervals —
   block resampling because throughput samples are autocorrelated; a deterministic
   PCG32 stream makes every interval exactly reproducible.

## The SpeedQX hybrid merge

Two headline numbers, honestly different questions (METHODOLOGY.md §6):

- **Capacity** (the big number): what the sources that can saturate your line agree on —
  a capability-weighted robust mean over the top tier (within 15% of the best), weighting
  each source by `capability / (variance + τ²)`. Single-stream tests read low under
  cross-traffic by design; capability priors encode that publicly, not silently.
- **Consensus**: a DerSimonian–Laird random-effects mean across all qualifying sources —
  the conservative all-sources view.
- **Confidence intervals**: Hartung–Knapp–Sidik–Jonkman over the random-effects model.
  With k = 2 sources an honest union band is shown instead.
- **Agreement**: **I²** (the meta-analysis heterogeneity statistic) replaces crude
  divergence flags — banded High / Moderate / Low / Very-low; Very-low shows a range
  rather than pretending one number. Agreement is diagnostic, never failure: AQM
  fair-queuing legitimately splits single-flow vs multi-flow readings, and both are
  disclosed when they diverge.

Sources need ≥ 4 cleaned samples per direction to join the merge; exclusions are listed
in the results, never dropped silently.

## Latency, jitter, responsiveness

- **Ping (headline) = minimum RTT** — the physical floor of the path, cross-checked
  against kernel `MinRTT` from the M-Lab sockets. P50/P75/P95/P99/mean/max sit one tap
  away.
- **Jitter (headline) = PDV** `P95(RTT) − P50(RTT)` (RFC 5481 flavor), with MAD and the
  legacy RFC 3550 EWMA disclosed as secondary fields.
- **Bufferbloat** = `P95(loaded RTT) − P50(idle RTT)` in milliseconds, graded
  A+ < 5 · A < 30 · B < 60 · C < 200 · D < 400 · F — an absolute scale that doesn't
  punish already-fast connections. The loaded/idle ratio is disclosed alongside.
- **Responsiveness (RPM)** = `60000 / P50(loaded RTT)` — working-conditions
  round-trips-per-minute, aligned with the IETF responsiveness draft (labeled *approx*:
  browser probes are same-origin multiplexed).
- **Packet loss** — 1000 UDP packets through a Cloudflare Realtime TURN relay; reported
  as `unavailable` (never guessed) if the relay is unreachable.

## FAST-mode early termination

Stopping "when the number looks stable" with ordinary confidence intervals is
statistically invalid (repeated peeking under-covers). FAST mode instead uses an
**anytime-valid empirical-Bernstein confidence sequence** with a strictly-predictable
running mean — valid at every sample size simultaneously — stopping a source when the
sequence half-width falls below max(5% of the estimate, 2 Mbps), gated off entirely on
high-RTT paths where early termination is known-unsafe. FULL mode never stops early.

## Cross-product reproducibility

The same methodology runs on this website, inside the iOS app's engine, and in the Rust
CLI. Parity is enforced by **golden-vector fixtures** (`golden-vectors.json`) committed
to all three repositories: pinned type-7 quantiles, a PCG32 PRNG with bit-identical
index streams, a hardcoded t-table, fixed summation order, and shared invNormal
constants. Arithmetic paths must match bit-for-bit; transcendental paths to 1e-9.

## Standards & references

- RFC 5481 (packet delay variation) · RFC 3550 (legacy jitter, compat field)
- IETF `draft-ietf-ippm-responsiveness` (RPM)
- DerSimonian & Laird (1986); Hartung–Knapp–Sidik–Jonkman small-k correction; Higgins I²
- Efron BCa bootstrap; circular block bootstrap (Politis; Hall–Horowitz–Jing block length)
- Waudby-Smith & Ramdas (anytime-valid confidence sequences)
- Ookla Speed Score trimean parity; M-Lab NDT7/MSAK design notes; Cloudflare AIM

*Full constants, payload schema, and disclosure model: [METHODOLOGY.md](./METHODOLOGY.md).*
