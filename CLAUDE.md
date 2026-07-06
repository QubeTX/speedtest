# QubeTX Speed Test — Project Guide

## Overview

Technician-grade internet speed test built with Vite + React 18 + TypeScript. SpeedQX Methodology v4 (`methodologyVersion: "4.0"`, see `METHODOLOGY.md`) runs up to seven measurement sources — Cloudflare, M-Lab NDT7, M-Lab MSAK, LibreSpeed, fast.com, CacheFly, Vultr — through a capability-weighted hybrid merge (capacity + DerSimonian–Laird consensus, HKSJ confidence intervals, I² agreement bands), Ookla-style trimean, RFC 5481 PDV jitter, bufferbloat delta-ms grading, and connection stability analysis. The same methodology ships across this website, the SpeedQX iOS app, and the `speedqx` CLI.

## Dev Commands

```bash
npm install           # Install deps + copy NDT7 workers to public/
npx vite --host       # Dev server (port varies — check for <title>QubeTX Speed Test</title>)
npx vite build        # Production build to dist/
npx tsc --noEmit      # Type check
npm run test          # Vitest — golden-vector fixtures pin TS↔Rust statistical parity
```

Vercel auto-deploys on push to main (Vercel's GitHub App integration — there is no GitHub Actions workflow in this repo).

## Architecture

### Test Flow (sequential)
1. **Latency Engine** (`src/services/latency-engine.ts`) — 50–200 HTTP pings to Cloudflare edge (scaled to test duration) with 3-ping warmup discard
2. **DNS Check** (`src/services/dns-check.ts`) — 12 domains in parallel (background, non-blocking)
3. **Network Metadata** (`src/services/network-metadata.ts`) — IP/ISP/geolocation from CF headers + ipinfo.io (background, non-blocking)
4. **Providers** (`src/services/provider-factory.ts` registry order) — run sequentially with a 1000 ms transition gap, each: download → upload (+ loaded-latency probes during Cloudflare saturation). FAST profile runs Cloudflare + NDT7 + MSAK (~1 min, anytime-valid empirical-Bernstein early stop); FULL profile runs all seven browser sources at fixed durations.
5. **Aggregation** (`src/services/aggregated-provider.ts` + `mergeProviders` in `statistics.ts`) — plateau warm-up discard → IQR filter (uploads: fastest 50%) → modified trimean → Hodges–Lehmann cross-check → circular block bootstrap (BCa 95% CI) → SpeedQX hybrid merge (capacity + DerSimonian–Laird consensus, HKSJ CIs, I² agreement bands)

### Key Services

| File | Purpose |
|------|---------|
| `src/services/statistics.ts` | Percentile, trimean, IQR filter, plateau warm-up detector, Hodges–Lehmann, circular block bootstrap, `mergeProviders` hybrid merge, PDV/jitter metrics, bufferbloat delta-ms grading, RPM, empirical-Bernstein confidence sequence |
| `src/services/stat-primitives.ts` | Type-7 quantiles, deterministic PCG32 + Lemire PRNG, inverse-normal/Φ helpers, Student-t table for HKSJ CIs |
| `src/services/methodology-version.ts` | `METHODOLOGY_VERSION` constant (`"4.0"`) stamped into every result payload |
| `src/services/latency-engine.ts` | HTTP RTT (50–200 samples) with PerformanceResourceTiming precision |
| `src/services/cloudflare-provider.ts` | Cloudflare speed test (bandwidthPercentile=0.5, loaded latency, jitter breakdown, TURN packet loss, AIM scores) |
| `src/services/ndt7-provider.ts` | M-Lab NDT7 — single-stream WebSocket, raw bandwidth sample collection, kernel `TCPInfo.MinRTT` |
| `src/services/msak-provider.ts` | M-Lab MSAK — 2-stream WebSocket throughput |
| `src/services/librespeed-provider.ts` | LibreSpeed — CORS-verified community backend rotation |
| `src/services/fastcom-provider.ts` | fast.com (Netflix OCA) via the `api/fastcom-targets.ts` Edge token relay; labeled *estimate*, hides on failure |
| `src/services/cachefly-provider.ts` | CacheFly — download-only range-request ladder |
| `src/services/vultr-provider.ts` | Vultr — download-only, min-RTT POP selection across 8 POPs |
| `src/services/aggregated-provider.ts` | v4 cross-provider orchestrator: sequential provider runs, per-provider pipeline, calls `mergeProviders` for the hybrid merge |
| `src/services/network-metadata.ts` | IP, ISP/ASN, geolocation, edge server from CF headers + ipinfo.io |
| `src/services/dns-check.ts` | 12-domain DNS probe with Resource Timing API breakdown |
| `src/services/provider-factory.ts` | Canonical provider registry order + FAST/FULL plan resolution + consent gating |
| `src/data/colo-map.ts` | Cloudflare IATA data center code-to-city name mapping (~57 PoPs) |

### Vercel Edge Functions (`api/`)

| File | Purpose |
|------|---------|
| `api/turn-credentials.ts` | Mints short-lived Cloudflare Realtime TURN credentials for packet-loss measurement (env: `REALTIME_TURN_TOKEN_ID`/`SECRET`); replaces the deprecated public TURN server whose credentials endpoint fails |
| `api/fastcom-targets.ts` | Token relay for fast.com (Netflix OCA) target discovery |

`vercel.json` adds SPA rewrites so direct loads of `/settings` and `/how-it-works` don't 404 under `BrowserRouter`.

### Testing

`golden-vectors.json` + `src/services/__tests__/statistics.test.ts` (54 Vitest cases, `npm run test`) pin the v4 statistical core (quantiles, PRNG, bootstrap, merge) to match the Rust implementation byte-for-byte.

### State Management
- `src/store/SpeedTestContext.tsx` — React Context wrapping `useSpeedTest` hook
- `src/hooks/useSpeedTest.ts` — Orchestrates latency engine + provider + DNS, manages phase state
- Settings persisted to localStorage via `useSettings` hook

### Routing (React Router v7)
- `/` — Main speed test (`SpeedTestPage` → `MainTestView`)
- `/settings` — Configuration (`SettingsPage` → `SettingsView`)
- `/how-it-works` — Technical report article (`TechnicalReportPage` → `TechnicalReportView`)

### Responsive Breakpoints

Single structural breakpoint (`WIDE_BREAKPOINT` in `src/theme/responsive.ts`): **900px**. Below it the layout stacks (narrow/mobile); at or above it the layout goes two-up ("wide"). The old four-tier mobile/tablet/smallDesktop/desktop matrix and `mechanismScale` are gone — all finer-grained sizing is fluid `clamp()` type/geometry (`index.css` custom properties, mirrored in `theme/tokens.ts`), not per-tier breakpoints.

Viewport height uses `100svh` (small viewport height) for mobile browser chrome compatibility.

### Layout
- `Apparatus` component provides the two-panel layout (left: mechanism + controls, right: data)
- `TapeMechanism` renders a canonical normalized 100-unit-viewBox SVG reel (`src/components/mechanism/reel-geometry.ts` + `TapeReel.tsx`) driven by `useReelDrive` — a self-suspending RAF integrator writing transforms imperatively (no more CSS `transform: scale()` sizing wrapper or keyframe-restart stutter); spin speed eases toward a log-scaled ω(Mbps) with asymmetric motor inertia, and tape visibly winds supply→take-up on download / rewinds on upload
- `PretextProvider` + `PretextBlock` use `@chenglou/pretext` for layout-shift prevention; text measurement imports the rendered font stack from `theme/tokens.ts` (Makira/Plex Mono aware, not hard-coded to Guton)

## Types

Key types in `src/types/speedtest.ts`:
- `TestProfile` — `'fast' | 'full'`; the v4 test mode (`Settings.testProfile`, default `'full'`) that drives the orchestrator, distinct from the legacy `ProviderMode` single-provider selector
- `SpeedTestResult` — v4 result payload (methodology §9): `methodologyVersion`, `platform`, `providerSet`, `capacityMbps`/`consensusMbps` (± CI), `agreement`/`uploadAgreement` (I² band), `rpm`, `providers[]`, `mergeExclusions`, `flowDisclosure`, plus `latencyStats`, `bufferbloat`, `stability`, `dnsCheck`, `networkMetadata`. `providerDivergence`/`jitterBreakdown`/`downloadEstimate`/`uploadEstimate` are retained from earlier versions; `providerResults` is explicitly `@deprecated`, kept one release as a populated alias so existing UI keeps rendering while the design layer migrates.
- `ProviderRunResult` — one entry in the L2 `providers[]` breakdown: `provider`/`name`, `availability` (`'ran' | 'unavailable-platform' | 'failed'`), per-direction `pingMs`/`downloadMbps`/`uploadMbps`/samples/bytes
- `AgreementInfo` — `{ i2, band }`; `AgreementBand` is `'high' | 'moderate' | 'low' | 'very-low' | 'insufficient'`
- `LatencyStats` — P50/P75/P95/P99, min/max/mean/stddev, `minRttMs`, `pdv` (headline jitter, P95−P50), jitter (RFC 3550, compat field), jitterMad
- `BufferbloatResult` — Unloaded/loaded latency stats, `deltaMs` (headline grading input), grade A+ through F, download/upload ratios (secondary)
- `StabilityMetric` — Coefficient of variation per direction, stable boolean
- `NetworkMetadata` — IP, ipVersion, ISP/ASN, city/region/country, lat/lng, colo/coloCity, TLS, TCP metrics
- `DnsProbeResult` — Per-domain with dnsMs/tcpMs/tlsMs/ttfbMs/totalMs
- `DnsCheckResult` — Aggregate with per-component averages

## Accuracy Methodology (v4)

`METHODOLOGY.md` is the canonical, versioned cross-product spec (methodology **4.0**), committed byte-identically across this website, the iOS app, and the `speedqx` CLI — every result payload carries `methodologyVersion: "4.0"`. `ACCURACY.md` is its engineering companion for this repo: where it summarizes, METHODOLOGY.md is exact.

- **Bandwidth**: Raw samples → **plateau warm-up detector** discards the ramp (3 consecutive samples within ±10% of the forward median, clamped 10–40%, replacing the old fixed 30% slow-start) → IQR outlier filter (k=1.5; uploads additionally keep the fastest 50%) → modified trimean (P10 + 8·P50 + P90)/10 → Hodges–Lehmann cross-check → **circular block bootstrap** (block ≈ n^⅓, B=2000) with **BCa** 95% intervals, using a deterministic PCG32 + Lemire PRNG for reproducibility
- **Aggregation**: The SpeedQX hybrid merge (`mergeProviders` in `statistics.ts`) — headline **capacity** (capability-weighted top-tier robust mean; priors CF/fast.com 1.0, LibreSpeed/CacheFly/Vultr 0.95, MSAK 0.85, NDT7 0.70; per-provider weight cap 0.70) + secondary **consensus** (DerSimonian–Laird random-effects mean), CIs via **Hartung–Knapp–Sidik–Jonkman**, and **I² agreement bands** (High/Moderate/Low/Very-low) replacing the old fixed >30% divergence flag. `MIN_MERGE_SAMPLES = 4`, with exclusions surfaced in the UI.
- **Latency**: 50–200 samples (scaled to test duration) with 3-ping warmup, PerformanceResourceTiming for precision, percentile breakdown. Headline **ping = min-RTT** (percentile ladder in drill-down).
- **Jitter**: Headline is **PDV** = P95 − P50 (RFC 5481). RFC 3550 EWMA (`J[i] = J[i-1] + (|D| - J[i-1]) / 16`) is demoted to a compat field.
- **Bufferbloat**: Headline is **delta-ms grading** (A+ <5 ms … F ≥400 ms); loaded/unloaded latency ratio is now the secondary figure.
- **Responsiveness (RPM)**: `60000 / P50(loaded RTT)`.
- **Test profiles**: FAST (~1 min, Cloudflare + NDT7 + MSAK, anytime-valid empirical-Bernstein confidence-sequence early stop, RTT-gated) vs FULL (every browser source, fixed durations, no early stop) — selected via the `testProfile` setting.

See `METHODOLOGY.md` for the canonical spec and `ACCURACY.md` for the engineering companion.

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataPanel` | `src/components/data/` | Assembles ping/jitter (SplitRow, with percentiles), download/upload (DataRow), the Responsiveness+Bufferbloat accuracy row, `MeasurementQuality`, `ProviderBreakdown`, and `DnsBar` |
| `SplitRow` | `src/components/data/` | Two-column ping/jitter row |
| `DataRow` | `src/components/data/` | Single metric row (download/upload) with progress + count-up |
| `VuMeter` | `src/components/data/` | 16-segment VU meter, log curve, peak-hold, shown live during download/upload |
| `MeasurementQuality` | `src/components/data/` | L1 summary: consensus, agreement (I² band), stability, packet loss, methodology stamp |
| `ProviderBreakdown` | `src/components/data/` | L2 per-provider drill-down table (`providers[]`) |
| `ActiveEdge` | `src/components/data/` | Phase-row active-edge lighting accent |
| `DnsBar` | `src/components/data/` | 12-dot DNS summary bar with timing breakdown overlay; keyboard-operable (real focusable control, Enter/Space toggles, Escape collapses) |
| `TapeMechanism` / `TapeReel` | `src/components/mechanism/` | Canonical cassette reel — normalized 100-unit viewBox SVG, area-conserving tape transfer, driven by `useReelDrive` |
| `TopBar` | `src/components/layout/` | QubeTX logo, clock, question mark icon |
| `Apparatus` | `src/components/layout/` | Two-panel responsive layout shell (branches on the single 900px breakpoint) |
| `AppStoreBadge` | `src/components/layout/` | iOS-only "Download on the App Store" badge linking to SpeedQX native app (renders `null` on non-iOS) |

`GlitchText` and the four-tier responsive matrix/`mechanismScale` were removed in the v4 design overhaul; the canonical `CRTOverlay` effect replaced duplicate inline CRT scanlines.

## Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useSpeedTest` | `src/hooks/` | Orchestrates latency + provider + DNS; manages phase state |
| `useIsWide` | `src/hooks/useResponsive.ts` | Single 900px structural breakpoint: `true` for the two-panel wide layout, `false` for stacked/mobile. Replaces the old four-tier `useResponsive()` (isMobile/isTablet/isSmallDesktop/isDesktop) |
| `useIsIOS` | `src/hooks/` | Detects iPhone + iPad (including iPadOS 13+ Mac-UA masquerade via `maxTouchPoints > 1`). Returns `false` before mount to avoid SSR/hydration flash |
| `useClock` | `src/hooks/` | Current time string for TopBar |
| `useNetworkInfo` | `src/hooks/` | Connection API (downlink, rtt, effective type) |
| `useReelDrive` | `src/hooks/` | Self-suspending RAF integrator driving the cassette reel transforms imperatively; log-scaled ω(Mbps) with asymmetric motor inertia; pauses when the tab is hidden or `prefers-reduced-motion` |
| `useCountUp` | `src/hooks/` | Odometer-style count-up animation for headline numerals |

## Static Assets

- `public/question-mark.svg` — help icon in TopBar
- `public/favicon.svg` — browser tab icon
- `public/app-store-badge.svg` — official Apple "Download on the App Store" black lockup. **Do not modify or optimize this file** — Apple Marketing Guidelines forbid recoloring, resizing below 40px height, or altering the SVG.
- `public/fonts/` — self-hosted typefaces: **Makira Sans** (display voice — heroes, headings, buttons, the stamp) + **IBM Plex Mono** (instrument voice — units, metric values, percentile ladders, micro-labels), both preloaded in `index.html`; **Guton** retained as a metrics-close fallback only.
- `public/ndt7-*-worker.js` — M-Lab NDT7 worker scripts, copied from `node_modules/@m-lab/ndt7` into `public/` by the `postinstall` script

## Native Companion App

SpeedQX is the native iOS version of this speed test, available at
`https://apps.apple.com/us/app/speedqx/id6760538784`. The `AppStoreBadge` component
in every page footer links to it, and only renders when `useIsIOS()` returns `true`.
Desktop, Android, and real-Mac visitors never see the badge — the detection is
precise enough (UA + `maxTouchPoints`) that we don't fall back to a broad
"any mobile" rule.

## Copyright

Every page wrapper (`src/pages/*.tsx`) must include the QubeTX copyright footer AND the `AppStoreBadge`:
```tsx
<div style={{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0',
  flexShrink: 0,
}}>
  <AppStoreBadge />
  <span style={{
    fontSize: '0.55rem',
    letterSpacing: '0.1em',
    color: 'rgba(0,0,0,0.2)',
    textAlign: 'center',
  }}>
    &copy; 2026 QUBETX
  </span>
</div>
```
Any new pages must include this. Article/view-level components should also include "BUILT BY QUBETX" in their footer where appropriate. The `AppStoreBadge` self-hides on non-iOS, so this pattern is safe to use everywhere. The `0.5rem` gap satisfies Apple's clear-space rule around the badge.

## Dependencies

- `@cloudflare/speedtest` v1.11.0 — Cloudflare edge speed test engine (custom TURN credential support, explicit packet-loss batch parameters)
- `@m-lab/ndt7` v0.1.4 — M-Lab NDT7 (dynamic import, UMD module)
- `@chenglou/pretext` — Container-aware text measurement
- `react-router-dom` v7 — Client-side routing
- `motion` v12 — Micro-interaction animation (press springs, stamp physics, progress shimmer)

---

## Subagent model preference (applies to ALL subagents in this repo)

When working in this repository, whenever you spawn a subagent — the `Agent` tool (**including Explore
and Plan agents**), `Workflow` agents, or any other subagent — use a top-tier model/effort pairing.
**Never** leave a subagent on a lower model or below `xhigh` effort.

**Per model — pick the model that fits the task, then its effort. Prefer the first; never go below either.**
- **Opus 4.8 [1m]:** `xhigh` **preferred** (most situations); `max` allowed when the agent judges it
  needs the deeper reasoning (e.g. the single hardest stage).
- **Sonnet 5:** `max` **preferred** (most situations); `xhigh` allowed when the agent doesn't need the
  extra thinking (e.g. cheaper/faster mechanical fan-out).

Only the **Opus** and **Sonnet** classes are in scope. **Never** a weaker/budget class (no **Haiku** or
older), and do **not** substitute the **Fable ("mythos")** class or any other/new class into the Opus or
Sonnet slot just because it's new or capable — adopting a different class is a deliberate change to this
convention, not an automatic remap. **Never below `xhigh`** effort. Which model + which of its two efforts
is the spawning/orchestrating agent's call per situation — just honor each model's preferred default and
the floor.

In `Workflow` scripts pass model + effort explicitly per agent (`{model:'opus', effort:'xhigh'|'max'}` or
`{model:'sonnet', effort:'max'|'xhigh'}`); for the `Agent` tool set `model` to `opus`/`sonnet` (it inherits
the session's `[1m]` context/effort).

---

## Mapping this forward (when new models are released)

This convention names **two specific model classes** — **Opus** and **Sonnet** — plus each one's **role**
and an **effort floor**. It is not tied to version numbers. When Anthropic ships a new lineup, advance
**each named class along its own lineage** (Opus → next Opus, Sonnet → next Sonnet) and keep it in role:

- **Opus class — flagship / deepest reasoning.** Today **Opus 4.8 [1m]** → the newest **Opus-class**
  model in its **largest-context** variant. Keep **`xhigh` preferred, `max` when needed**. Role: deep
  synthesis, planning, verification, the single hardest stage.
- **Sonnet class — workhorse / high-throughput.** Today **Sonnet 5** → the newest **Sonnet-class**
  model. Keep **`max` preferred, `xhigh` when lighter**. Role: high-parallelism fan-out, mechanical/bulk work.
- **Only the Opus and Sonnet classes are in scope — mind the other classes.** **Haiku** is the excluded
  budget class (never use it for subagents). The **Fable ("mythos") class** — and any other or brand-new
  class — is **not** one of these two slots: do **not** silently map a Fable/mythos model into the Opus
  or Sonnet role just because it's new, large, or capable. Adopting a different class is a *deliberate*
  update to this convention, never an automatic role-remap.
- **The floor holds regardless of names:** never a class below Sonnet (no Haiku/older), and **never
  below `xhigh`** effort.

**At each release, do this:**
1. Find the current **Opus-class** and **Sonnet-class** models (same class lineage as today). Ignore
   Haiku, and ignore any other class (e.g. Fable/mythos) unless this convention is explicitly updated to include it.
2. Swap in the new Opus-class and Sonnet-class names; keep each class's preferred/allowed efforts and the floor.
3. If the effort-level names change, preserve the *shape* on the effort ladder: Opus defaults to
   **one below the top** and may go **top**; Sonnet defaults to the **top** and may drop **one below**.
   The floor stays at "one below the top" (today = `xhigh`) — never lower.
4. Confirm the exact model IDs and the long-context suffix (today `[1m]`), and update the
   `{model:'opus'|'sonnet'}` tool aliases if the class keywords change. (Check current model docs /
   the `claude-api` reference.)
5. Bump the "Set …" date.

**Rule of thumb:** _Opus + Sonnet classes only (never Haiku, never auto-adopt Fable/mythos), top-ish
effort, never below the second-highest effort._
