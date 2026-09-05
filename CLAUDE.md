# QubeTX Speed Test — Project Guide

## Overview

SpeedQX Methodology v5 uses monotonic payload counters, explicit bounded warm-up, sustained bytes/time, repeatable ceilings and a median of qualifying Cloudflare/MSAK primary networks. Quick (90 seconds) is the default; Deep repeats/extends primary measurements and adds supplementary sources. NDT7 is a separate single-stream measurement. The website owns the canonical TypeScript acquisition, measurement contract, guide and cassette geometry, generated into a pinned Expo copy. Rust is independently verified with complete trace replay.
## Dev Commands

```bash
npm install           # Install deps + copy NDT7 workers to public/
npx vite --host       # Dev server (port varies — check for <title>QubeTX Speed Test</title>)
npx vite build        # Production build to dist/
npx tsc --noEmit      # Type check
npm run test          # Vitest — golden-vector fixtures pin TS↔Rust statistical parity
```

Vercel auto-deploys on push to main. GitHub Actions gates measurement tests, production build and dependency audit before merge.

## Architecture

### Current measurement path

`provider-factory.ts` selects `engine-v5.ts`. `acquisition-v5.ts` supplies cumulative byte traces from bounded HTTP transfers and receiver-accounted M-Lab WebSockets. `measurement-v5.ts` interprets them using `measurement-contract-v5.json`. Fixed warm-up, zeros, partial final intervals, provider grouping and qualification must remain aligned with Rust. Discovery URLs are reused within a run and never printed with signed query tokens.

The Expo generator pins the canonical git revision and normalized SHA-256 hashes. Commit canonical changes before regenerating the app; never hand-edit its generated engine, cassette geometry or shared guide. `methodology-guide-v5.json` supplies the matching explanatory screens. `METHODOLOGY.md` is the current normative contract; v4 documentation and statistical code remain explicitly historical.

`useSpeedTest` owns the browser run lifecycle, asynchronous wake lock and auxiliary DNS/metadata. Presentation never changes acquired samples. Stop, cap, background and network transitions preserve valid partial results. Existing DNS/metadata cannot delay the bounded result.

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
- `MainTestView` and `instrument-v5.css` provide the current cassette/measurement layout; older apparatus/data panels are retained historical components.
- `TapeMechanism` renders a canonical normalized 100-unit-viewBox SVG reel (`src/components/mechanism/reel-geometry.ts` + `TapeReel.tsx`) driven by `useReelDrive` — a self-suspending RAF integrator writing transforms imperatively (no more CSS `transform: scale()` sizing wrapper or keyframe-restart stutter); spin speed eases toward a log-scaled ω(Mbps) with asymmetric motor inertia, and tape visibly winds supply→take-up on download / rewinds on upload
- `PretextProvider` + `PretextBlock` use `@chenglou/pretext` for layout-shift prevention; text measurement imports the rendered font stack from `theme/tokens.ts` (Makira/Gail Rock aware, not hard-coded to Guton)

## Types

Key types in `src/types/speedtest.ts`:
- `TestProfile` — `'fast' | 'full'`; the shared Quick/Deep mode (`Settings.testProfile`, default `'fast'`) that drives the orchestrator, distinct from the legacy `ProviderMode` single-provider selector
- `SpeedTestResult` — versioned payload; v5 adds nullable sustained/ceiling/qualification fields under `measurement` and separately labeled `httpLatency`. Historical v4 fields remain for reading old records. Legacy payload (methodology §9): `methodologyVersion`, `platform`, `providerSet`, `capacityMbps`/`consensusMbps` (± CI), `agreement`/`uploadAgreement` (I² band), `rpm`, `providers[]`, `mergeExclusions`, `flowDisclosure`, plus `latencyStats`, `bufferbloat`, `stability`, `dnsCheck`, `networkMetadata`. `providerDivergence`/`jitterBreakdown`/`downloadEstimate`/`uploadEstimate` are retained from earlier versions; `providerResults` is explicitly `@deprecated`, kept one release as a populated alias so existing UI keeps rendering while the design layer migrates.
- `ProviderRunResult` — one entry in the L2 `providers[]` breakdown: `provider`/`name`, `availability` (`'ran' | 'unavailable-platform' | 'failed'`), per-direction `pingMs`/`downloadMbps`/`uploadMbps`/samples/bytes
- `AgreementInfo` — `{ i2, band }`; `AgreementBand` is `'high' | 'moderate' | 'low' | 'very-low' | 'insufficient'`
- `LatencyStats` — P50/P75/P95/P99, min/max/mean/stddev, `minRttMs`, `pdv` (headline jitter, P95−P50), jitter (RFC 3550, compat field), jitterMad
- `BufferbloatResult` — Unloaded/loaded latency stats, `deltaMs` (headline grading input), grade A+ through F, download/upload ratios (secondary)
- `StabilityMetric` — Coefficient of variation per direction, stable boolean
- `NetworkMetadata` — IP, ipVersion, ISP/ASN, city/region/country, lat/lng, colo/coloCity, TLS, TCP metrics
- `DnsProbeResult` — Per-domain with dnsMs/tcpMs/tlsMs/ttfbMs/totalMs
- `DnsCheckResult` — Aggregate with per-component averages

## Accuracy and validation

The headline means sustained application throughput on this device/path, not ISP physical capacity. Retain provider disagreement and unavailable states. Common ping is median idle HTTP RTT; minimum HTTP and server TCP RTT remain distinct. HTTP failure rate is not packet loss. Observed repeatability ranges have no nominal confidence coverage claim.

`measurement-v5-fixtures.json` and the Rust replay example validate complete estimates. `scripts/validate-transport.mjs` records independently paced loopback payload and configured rate separately; its v4 comparison is estimator replay, not a full legacy-transport comparison. `evidence/v5` distinguishes deterministic, controlled acquisition, visual and physical acceptance. The v4 golden tests remain historical regression coverage.

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
- `public/fonts/` — self-hosted typefaces: **Makira Sans** (display voice — heroes, headings, buttons, the stamp) + **Gail Rock** (instrument voice — units, metric values, percentile ladders, micro-labels), both preloaded in `index.html`; Makira also supplies body text. Gail Rock weights come from the same supplied family as the native app.
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
