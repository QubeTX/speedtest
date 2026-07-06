# Changelog

All notable changes to this project will be documented in this file.

## [3.0.9] — 2026-07-06

### Fixed

- **Packet loss under-reported ~100×** — the engine returns loss as a 0–1 ratio
  (lost/sent) but the display chain, tooltip grade bands, and the spec all speak
  percent; a real 2% loss displayed as "0.0%". Converted at the provider
  boundary (defensively: values > 1 pass through). Found by the iOS port's
  adversarial review comparing the two implementations.

## [3.0.8] — 2026-07-06

### Added

- **Alternate-mode re-run after completion** — RUN AGAIN repeats the exact test
  you just ran; a compact secondary button beneath it offers the *other* mode
  (DEEP TEST after a quick run, QUICK TEST after a deep run), so it's never
  redundant. `ActionButton` gains a `small` size; the last-used profile is
  exposed through the speed-test context.

## [3.0.7] — 2026-07-06

### Changed

- **The cassette deck is now landscape** — reels side by side like a real
  cassette (supply on the left feeding the take-up on the right, tape window
  rails spanning between them), matching the iOS app's deck orientation. The
  tape-transfer animation now reads left→right on download and rewinds
  right→left on upload — the way every tape you've ever seen works. Sizing
  stays fully fluid (two reels + gap fit a 320 px viewport).

## [3.0.6] — 2026-07-06

### Fixed

- **Rapid phase flashing between providers** (e.g. Cloudflare-upload ↔ NDT7-download) —
  engines can keep emitting events after their run settles (loaded-latency probes,
  packet-loss completion); those stragglers interleaved with the next source's
  progress. Each source's event stream is now sealed the instant its run resolves.
- **Tooltips detaching from their triggers** — a one-shot position measurement went
  stale whenever the trigger sat inside something still animating (the quality
  expander) or the page shifted. Tooltips now track their trigger every frame while
  open, following any animation, reflow, or scroll.
- **Broken rounded corners** (top/bottom-right on desktop, both bottom corners on
  mobile) — the data panel's square cards overflowed the shell's rounded corners;
  the shell now clips its children (safe since tooltips render in a portal).
- **TEST COMPLETE stamp legibility** — the translucent multiply-blended plate went
  dark exactly where it crossed the dark tape pack; now a solid paper plate with a
  shadow, fully readable anywhere on the deck.

### Changed

- **One play control instead of three** — the cassette deck's play glass is the
  primary (fast) start, captioned beneath the deck; the redundant PLAY pill was
  removed and DEEP TEST remains the single secondary action.

## [3.0.5] — 2026-07-06

### Added

- **Non-network failure isolation, systemically** — a failed or throttled test
  service can no longer freeze a run or silently poison accuracy:
  - every source now runs under a 30 s liveness watchdog (no progress → cut off,
    partial data kept, run continues);
  - a **screen wake lock** is held for the duration of a run, and the
    orchestrator pauses between sources while the page is hidden — a locked
    phone or background tab makes the browser throttle transfers, which was
    reading as garbage-low speeds on mobile;
  - a **leave-one-out agreement diagnostic** names the single source whose
    readings are wildly inconsistent with all the others (source-side
    throttling or an overloaded test server, not your network);
  - all of the above surface as **measurement notices** in the results panel —
    disclosed, never silently absorbed. (`warnings` field on the result payload.)

### Fixed

- **Desktop tooltip alignment** — bubbles were measured mid-entrance-animation
  (scale 0.92), so every position was computed from a slightly-wrong size;
  now measured from the untransformed layout box and centered on the trigger
  with the arrow pointing at it (viewport-clamped at edges).

## [3.0.4] — 2026-07-06

### Fixed

- **Frozen "Cloudflare download" phase (seen on mobile)** — `speed.cloudflare.com`
  rate-limits large download payloads per IP (HTTP 429 with a multi-minute
  Retry-After); the engine retries silently forever, wedging the phase. A 25 s
  stall watchdog now stops the engine and fails the Cloudflare source cleanly —
  the run continues on the remaining sources and the failure is disclosed in the
  per-source breakdown. This same throttling explains erratic/low Cloudflare
  download readings (and understated capacity headlines) on runs where it
  engaged: with the strongest saturating source silently crippled, the merge
  fell back to remote-limited single-connection sources.

## [3.0.3] — 2026-07-06

### Changed

- **QubeTX logo (deck top bar) and "BUILT BY QUBETX" now link to qubetx.com**
  (new tab, subtle dotted underline on the text link).

### Removed

- **Fake "speed" readouts from the Network Information API** — the bottom-left
  deck line (e.g. "10 MBPS · 0 MS RTT") and the Settings NETWORK block's
  SPEED CLASS / EST. BANDWIDTH / EST. RTT rows. Chrome privacy-caps `downlink`
  at 10 Mbps and quantizes `rtt`, so these were pseudo-numbers sitting next to
  real measurements. The factual physical connection type (WIFI/CELLULAR, where
  the platform reports it) is retained.

## [3.0.2] — 2026-07-06

### Changed

- **How-it-works page fully rewritten for Methodology v4** — restructured into 15
  cleanly-numbered sections, each opening with a labeled **TT;DR** plain-English lead
  (full technical depth kept beneath). Fixes all stale v2/v3 content: dual-provider
  framing → the seven-source registry (+ Apple as CLI-only), provider divergence →
  I² agreement bands, old inverse-variance weighting → the capacity/consensus hybrid
  merge, ratio-graded bufferbloat → delta-ms grades, flat "100 pings" → duration-scaled
  probing, RFC 3550 headline jitter → PDV. Adds FAST/DEEP TEST early-stopping,
  min-RTT ping, RPM, Realtime-TURN packet loss, plateau detection, block bootstrap +
  BCa, golden-vector cross-product parity, and the corrected stability threshold
  (CV < 0.15). Comparison table made fairer and relabeled to SpeedQX.
- **Settings page audited for v4** — removed the DEFAULT TEST profile picker
  (redundant with the PLAY / DEEP TEST deck buttons) and the legacy PROVIDER picker
  (the M-Lab consent toggle is the real gate; stored single-provider modes are
  migrated back to the full registry on load). Duration is now **PER-SOURCE DURATION**
  with an explainer and AUTO/15/30/60 options only — the old 2/5/10-minute options
  would have multiplied across seven sequential Deep Test sources (stored legacy
  values are clamped to 60 s). Consent copy names both M-Lab sources (NDT7 + MSAK)
  and states what declining does.
- METHODOLOGY.md §3 FAST duration corrected to match measured reality (~1 minute
  end-to-end; the conservative confidence sequence rarely stops a source before its
  25 s sampling cap) — synced byte-identical to all three product repos.

## [3.0.1] — 2026-07-06

### Fixed

- **Jitter showing blank instead of 0** — the count-up numeral never wrote its text when
  the value at mount equaled its initial value (exactly the case on a rock-stable line
  where PDV = 0). `useCountUp` now returns a callback ref that writes the current value
  the moment the element mounts.
- **Tooltips clipped by panel edges** — bubbles now render in a portal to `document.body`
  with viewport-clamped fixed positioning (the MEASUREMENT QUALITY expander's
  `overflow: hidden` was cutting them off). Tooltips close on scroll and are tappable
  without dismissing on mobile.
- **“VERY LOW” agreement explained** — the quality band pill now opens a plain-language
  Measurement Quality explainer; the Source Agreement tooltip copy was rewritten to say
  what disagreement means, why it happens, and what to trust.

## [3.0.0] — 2026-07-06

SpeedQX Methodology v4 + full design overhaul. The measurement engine, the statistical
core, and the visual system were rebuilt in one release; the same methodology now ships
(or is shipping) across the website, the iOS app, and the `speedqx` CLI.

### Added — Methodology v4 (see METHODOLOGY.md, `methodologyVersion: "4.0"`)

- **Five new measurement sources** alongside Cloudflare + M-Lab NDT7: **M-Lab MSAK**
  (2-stream WebSocket, `src/services/msak-provider.ts`), **LibreSpeed**
  (CORS-verified backend rotation, `librespeed-provider.ts`), **fast.com** (Netflix OCA
  targets via a Vercel Edge token relay `api/fastcom-targets.ts`; labeled *estimate*,
  hides on failure, `fastcom-provider.ts`), **CacheFly** (download-only range ladder,
  `cachefly-provider.ts`), and **Vultr** (download-only, min-RTT selection across 8
  POPs, `vultr-provider.ts`). Apple networkQuality is registered as a CLI-only source
  and rendered greyed (`availability: unavailable-platform`) — never silently missing.
- **The SpeedQX hybrid merge** (`mergeProviders` in `src/services/statistics.ts`):
  headline **capacity** (capability-weighted top-tier robust mean, priors
  CF/fast.com 1.0 · LibreSpeed/CacheFly/Vultr 0.95 · MSAK 0.85 · NDT7 0.70) +
  secondary **consensus** (DerSimonian–Laird random-effects mean), CIs via
  **Hartung–Knapp–Sidik–Jonkman** (t-table pinned df ≤ 7; k=2 → honest union band),
  and **I² agreement bands** (High/Moderate/Low/Very-low) replacing the old >30%
  divergence flag. Per-provider weight cap 0.70; `MIN_MERGE_SAMPLES = 4` with
  exclusions surfaced in the UI.
- **v4 statistical core** (`src/services/stat-primitives.ts` + `statistics.ts`):
  type-7 quantiles, deterministic **PCG32 + Lemire** PRNG, **circular block bootstrap**
  (ℓ = max(2, round(n^⅓)), B = 2000) with **BCa** 95% intervals, **plateau warm-up
  detector** (3 consecutive samples within ±10% of the forward median, clamped 10–40%)
  replacing the fixed 30% slow-start discard, and a Hodges–Lehmann cross-check.
  Golden-vector fixtures (`golden-vectors.json`) + 54 Vitest tests
  (`src/services/__tests__/statistics.test.ts`) pin TS↔Rust parity.
- **New headline metrics**: ping = **min-RTT** (percentile ladder in drill-down);
  jitter = **PDV** `P95 − P50` (RFC 5481; RFC 3550 EWMA demoted to a compat field);
  **bufferbloat delta-ms grading** (A+ <5 … F ≥400) with the ratio as secondary;
  **Responsiveness (RPM)** = 60000 / P50(loaded RTT).
- **FAST / FULL dual-mode start** — two deck actions (PLAY ≈ 1 min, 3 sources, with
  **anytime-valid empirical-Bernstein confidence-sequence early stopping**, RTT-gated;
  DEEP TEST = every browser source, fixed durations) plus a default-profile setting.
- **Result payload v4**: `providers[]` array with per-source `availability`,
  `capacityMbps`/`consensusMbps` ± CI, `agreement {i2, band}`, `rpm`,
  `mergeExclusions`, `methodologyVersion`, `platform`, `providerSet`
  (`providerResults{}` object retained one release as a deprecated alias).
- **Packet loss on Cloudflare Realtime TURN** — `api/turn-credentials.ts` Edge function
  mints short-lived credentials (env: `REALTIME_TURN_TOKEN_ID/SECRET`); replaces the
  engine's deprecated public TURN server, whose credentials endpoint already fails.
  Packet loss degrades to *unavailable* (never fabricated) if the relay is unreachable.

### Added — Design overhaul

- **New type system**: **Makira Sans** (display: heroes, headings, buttons, stamp) +
  **IBM Plex Mono** (instrument voice: units, metric values, percentile ladders,
  micro-labels), self-hosted woff2 with preloads; Guton retained as fallback.
- **Canonical cassette reel** (`src/components/mechanism/reel-geometry.ts` +
  `TapeReel.tsx` rewrite): normalized 100-unit viewBox SVG (strokes scale with size),
  static flange/tape-pack layers + rotating spool (3 bold spokes, 6 spline teeth),
  **area-conserving tape transfer** — tape visibly winds supply→take-up on download
  and rewinds on upload: `R(f) = √(16² + f·(39²−16²))`.
- **Motion drive** (`src/hooks/useReelDrive.ts`): single self-suspending RAF integrator
  writing transforms imperatively — spin speed eases toward a log-scaled ω(Mbps)
  (0.35→2.2 rev/s) with asymmetric motor inertia (τ 0.45 s up / 0.9 s down). Kills the
  keyframe-restart stutter of the old CSS animation; pauses when the tab is hidden.
- **Micro-interactions**: 16-segment VU meter (`VuMeter.tsx` — log curve, peak-hold),
  odometer count-ups (`useCountUp.ts`), press springs, phase-row active-edge lighting,
  refined TEST COMPLETE stamp physics, progress shimmer, single-backdrop-filter rule.
- **Mobile overhaul**: one 900 px structural breakpoint (`useIsWide()`), fluid `clamp()`
  type + reel geometry (no more `scale(0.65)` blur), safe-area insets, ≥44 px targets.
- **Accessibility**: full `prefers-reduced-motion` support (reels freeze, tape-radius
  still conveys progress; global animation+transition neutralization), the deck is a
  real `<button>` with `aria-busy` + focus-visible rings, `aria-live` status region,
  keyboard-operable DNS bar, decorative SVG hidden from the tree.

### Changed

- `@cloudflare/speedtest` 1.7.0 → **1.11.0** (custom TURN credential support; explicit
  packet-loss batch parameters).
- Inter-provider transition 3000 ms → **1000 ms**; provider progress is mapped across
  the full registry with per-source failure isolation.
- `ACCURACY.md` rewritten for v4 and now defers to METHODOLOGY.md; the How-It-Works
  page updated to match.
- `package.json` version synced to the release (was stuck at 1.0.0).

### Fixed

- **Deep links 404** — `vercel.json` SPA rewrites: direct loads of `/settings` and
  `/how-it-works` now work (BrowserRouter previously 404'd on refresh/direct entry).
- FAST-mode early-stop confidence sequence uses a strictly-predictable running mean
  (the anytime-validity guarantee requires it; the inclusive form was ~2.6%
  anti-conservative).
- Vultr POP probing can no longer stall a FULL run on an unreachable POP
  (per-probe 5 s timeout + `Promise.allSettled`); MSAK no longer opens a fresh upload
  after Stop; fastcom relay retries the pinned fallback token before failing;
  provider factory enforces M-Lab consent gating for direct callers.
- Pretext text measurement now imports the rendered font stack from tokens
  (was hard-coded Guton → measured wrong widths under the new type system).

### Removed

- `GlitchText` component and its 50 ms `setInterval` transform loop, dead `glitch-anim`
  keyframes, the four-tier responsive matrix and `mechanismScale`, duplicate inline CRT
  scanlines (canonical `CRTOverlay` restored).

## [2.3.0] — 2026-04-21

### Added

- **SpeedQX iOS App Store badge (iOS-only)** — The official "Download on the App Store" black lockup badge now appears in the page-level footer on all three routes (`/`, `/settings`, `/how-it-works`) for iOS visitors only. Links to the native companion app at `apps.apple.com/us/app/speedqx/id6760538784`. Desktop, Android, and real Mac users see the unchanged footer — no badge is rendered for them.
- **`useIsIOS()` hook** (`src/hooks/useIsIOS.ts`) — Reliable iOS detection combining `userAgent` regex with `navigator.maxTouchPoints > 1` to catch iPadOS ≥13's "Macintosh" masquerade. Seeded to `false` and computed in `useEffect` to avoid any flash for non-iOS users.
- **`AppStoreBadge` component** (`src/components/layout/AppStoreBadge.tsx`) — Stateless component that short-circuits on non-iOS and renders the 40px Apple-compliant badge with a subtle `scale(1.04)` hover. The badge SVG is served unmodified from `public/app-store-badge.svg` per Apple Marketing Guidelines (no recoloring, no opacity reduction on the badge itself).

### Changed

- All page footers (`SpeedTestPage`, `SettingsPage`, `TechnicalReportPage`) restructured from single-line copyright to vertical flex stack: `AppStoreBadge` on top (iOS only), `© 2026 QUBETX` below, with a `0.5rem` gap satisfying Apple's clear-space requirement (1/10 of badge height).

### Verification

- Playwright device-emulation suite (`scripts/verify-app-store-badge.cjs`) confirms: desktop no-render, iPhone render, iPad-masquerade render, real-Mac no-render, Android no-render.

## [2.2.1] — 2026-04-11

### Fixed

- **Tooltip still semi-transparent during entrance animation** — Explicitly pin `opacity: 1` in both `initial` and `animate` motion states. The prior fix (2.1.3) removed opacity from `initial` but framer-motion still inferred an opacity transition from the `exit: { opacity: 0 }` prop, causing a brief transparency during entrance. Now fully opaque at every frame.

## [2.2.0] — 2026-04-11

### Added

- **Network metadata collection** — IP address, ISP/ASN, IPv4/IPv6 detection, user geolocation (city/region/country), Cloudflare edge data center with IATA code-to-city mapping, and TCP server-timing metrics (RTT, MinRTT from kernel). Fetched in parallel from Cloudflare `__down` CORS-exposed response headers + ipinfo.io enrichment for ISP name.
- **Jitter breakdown** — Idle, during-download, and during-upload jitter now displayed separately. The per-direction data was already computed by Cloudflare's engine (`getDownLoadedJitter()` / `getUpLoadedJitter()`) but never surfaced — now wired to the result and shown in the DataPanel.
- **Bootstrap confidence intervals** — 95% CI for download/upload speed via 1,000-iteration percentile bootstrap resampling (`bootstrapCI()` in statistics module). Displays as "95% CI: 41.2–49.1 (±3.9)" below the speed breakdown.
- **Inverse-variance weighted provider merge** — Bandwidth weights now computed dynamically from sample variance instead of fixed 60/40 split. The minimum-variance unbiased estimator gives more weight to the provider with more consistent measurements, clamped to [0.3, 0.7] to prevent degenerate cases.
- **Winsorized mean cross-validation** — Second robust estimator validates IQR-filtered trimean results. When IQR-filtered and winsorized trimean diverge by >15%, they are averaged for robustness against bimodal distributions.
- **Tooltip explanations** for jitter breakdown (idle/DL/UL), confidence intervals, IP address, ISP/ASN, edge server, dynamic weights, and winsorized validation.
- **IATA data center code-to-city mapping** (`src/data/colo-map.ts`) — ~57 common Cloudflare PoPs worldwide.

### Changed

- **SysInfo component** now displays ISP name with ASN, IP address with IPv4/IPv6, user city/country, and Cloudflare edge data center name. Metadata resolves ~2–3s into the test (during latency phase), appearing before the test completes.
- **Clipboard auto-copy** now includes ISP, IP, location, edge server, per-direction jitter breakdown, and 95% confidence intervals.
- **Download/upload breakdown** now shows 95% confidence interval range below the CF/NDT per-provider values.

### Technical

- New `network-metadata.ts` service fetches from Cloudflare `__down` CORS headers + ipinfo.io in parallel with 3-second timeout.
- New `winsorize()`, `bootstrapCI()`, `inverseVarianceMerge()`, `variance()` functions in statistics module.
- `NetworkMetadata`, `JitterBreakdown`, `BandwidthEstimate` types added to type system.
- `networkMetadata` state added to `useSpeedTest` hook and `SpeedTestContext`.

## [2.1.3] — 2026-04-08

### Fixed

- **Progress bar stalling at 50% in aggregated mode** — Removed the 0-50%/50-100% progress scaling between providers. Each provider's bars now go 0-100% independently, with the phase label indicating which provider is active. Eliminates the visible stall at 50% during provider transitions.
- **Tooltip transparency** — Removed opacity entirely from the entrance animation. Tooltips now appear at full opacity from the first frame (only scale/y animate in). Exit still fades out over 100ms.

## [2.1.2] — 2026-04-08

### Fixed

- **Progress bar stalling at ~50%** — Replaced separate download/upload byte tracking with unified overall progress across all Cloudflare measurement types. Progress now advances smoothly through interleaved download and upload phases instead of stalling when the active measurement type switches.
- **Provider transition delay** — Reduced the pause between Cloudflare and NDT7 providers from 3 seconds to 1 second in aggregated mode.
- **Tooltip opacity** — Title text now uses color differentiation (`rgba(255,255,255,0.75)`) instead of `opacity: 0.6`, ensuring all tooltip elements are fully opaque.

### Changed

- **Responsive tooltip sizing** — Tooltip font size, maxWidth, and padding now scale with viewport breakpoint: 0.65rem/240px on mobile up to 0.8rem/340px on desktop.
- **Tooltip touch targets** — Trigger hit areas enlarged to 44×44px minimum on mobile for Apple HIG compliance.
- **Tooltip Pretext integration** — Tooltip body content wrapped in PretextBlock with breakpoint-specific entries for accurate height reservation during spring animations.

## [2.1.1] — 2026-04-08

### Fixed

- **Progress bar accuracy (Cloudflare)** — Switched from count-based to byte-weighted progress tracking. Previously, the 19 small chunks (100KB–10MB) raced the bar to ~75% despite being only ~5% of total data, then it stalled on the large 100MB/250MB chunks. Now each chunk's weight is proportional to its byte size.
- **Progress bar accuracy (NDT7)** — Capped time-based progress at 95% so the bar never appears "done" before the download/upload phase actually completes. The completion callback snaps it to 100%.

## [2.1.0] — 2026-04-07

### Added

- **Interactive metric tooltips** — Hover (desktop) or tap (mobile) any technical metric label to see a layman-friendly explanation. Covers P50/P95/P99, RFC 3550, standard deviation, samples, CF/NDT provider labels, AVG badge, bufferbloat grade, load ratio, stability, coefficient of variation, provider divergence, and DNS/TCP/TLS/TTFB column headers. Tooltips are context-aware: they show only the relevant quality range based on your actual measured value, rather than listing all possible ranges.
- **Tooltip component** (`src/components/ui/Tooltip.tsx`) — Reusable, accessible tooltip with Motion (Framer Motion) spring animations, 150ms show delay, 300ms linger on unhover (so you can mouse into the bubble), viewport-aware repositioning, keyboard support (Tab to focus, Escape to close), mobile tap-to-toggle with outside-tap dismiss, and ARIA attributes.
- **Tooltip collision awareness** — Shared `TooltipProvider` context ensures only one tooltip is visible at a time. Opening a new tooltip instantly closes the previous one, preventing overlap between adjacent metric labels.
- **Tooltip content map** (`src/content/tooltips.ts`) — Centralized definitions for 18 metrics with titles, descriptions, and optional value-based ranges for dynamic feedback.

### Changed

- **Custom typography — Guton Sans Serif** — Replaced Google Fonts Inter with the licensed Guton Sans Serif typeface (geometric sans-serif, 5 weights: Regular through ExtraBold). Self-hosted via `public/fonts/` with woff2/woff formats and font-display: swap. Preloads critical weights (Regular, Medium, SemiBold) for zero FOIT.
- **Accuracy metrics bar redesign** — Replaced colorful badge soup with a clean, structured layout matching the monochrome industrial aesthetic. Each metric uses label-above-value stacking for clear association. AIM scores in an even-column grid, bufferbloat/stability/divergence in a responsive grid below with detail values inline. Proper spacing between groups with subtle separator lines.
- **Tooltip opacity** — Tooltip bubbles now use fully opaque `#111111` background instead of semi-transparent, ensuring text is always legible over any content.
- **Technical report typography** — Two spaces after every period on the How It Works page for improved readability.

### Dependencies

- Added `motion` (Framer Motion) for tooltip enter/exit animations

## [2.0.0] — 2026-04-07

### Added

- **Dedicated latency engine** — New standalone measurement phase runs 100 HTTP RTT samples against Cloudflare edge before bandwidth tests begin. Includes 3-ping warm-up (discarded) to eliminate DNS/TCP/TLS setup noise. Reports P50, P75, P95, P99, min, max, mean, stddev.
- **RFC 3550 jitter** — Primary jitter metric now uses the exponentially weighted moving average from RFC 3550 (RTP standard): `J[i] = J[i-1] + (|D(i-1,i)| - J[i-1]) / 16`. Legacy MAD (mean absolute deviation) jitter retained for comparison.
- **Latency percentile display** — Ping section now shows P50, P95, P99 breakdown below the headline number. Jitter section shows sample count and stddev.
- **Bufferbloat detection** — Measures loaded latency (during download/upload) vs unloaded latency and assigns a grade (A through F) based on the ratio. Cloudflare's concurrent latency probes fire every 200ms during bandwidth tests, collecting up to 50 data points.
- **Connection stability metric** — Coefficient of variation (CV = stddev/mean) computed for download and upload bandwidth samples. Displayed as STABLE/VARIABLE badge with per-direction CV percentages.
- **Provider divergence detection** — When Cloudflare and NDT7 bandwidth results differ by >30%, a DIVERGENCE warning badge appears with per-direction percentages. Helps identify throttling, QoS, or routing differences.
- **Accuracy metrics bar** — New UI section between upload row and DNS bar displays bufferbloat grade, stability indicator, and divergence warning as colored badges.
- **Statistics module** (`src/services/statistics.ts`) — Pure math utilities: percentile (linear interpolation), classic trimean, modified trimean (Ookla-style 1:8:1), IQR outlier filtering, slow-start discard, coefficient of variation, confidence-weighted merge, RFC 3550 jitter, latency stats builder.
- **Enhanced DNS diagnostics** — Now probes 12 domains (added facebook.com, twitter.com, youtube.com, reddit.com). Uses Performance Resource Timing API for per-probe DNS/TCP/TLS/TTFB timing breakdown. Desktop detail overlay shows timing columns. Dual-pass probing available for DNS cache analysis.
- **Larger test payloads** — Added 100MB and 250MB download chunks plus 50MB upload chunks to properly saturate gigabit+ connections.
- **Cloudflare AIM scores** — Extracts and displays Aggregated Internet Measurement scores (streaming, gaming, real-time communication quality ratings) from Cloudflare's engine.
- **"How It Works" page** — Consumer-friendly technical article at `/how-it-works` explaining measurement methodology, accuracy techniques, and comparison to alternatives. Accessible via question mark icon in the top bar.
- **Tab visibility awareness** — Latency engine pauses measurement when the browser tab is backgrounded (browsers throttle background tabs, which would produce inflated RTT values).
- **Duration-adaptive latency samples** — Latency engine now scales sample count with test duration: 50 samples at 15s, 100 at 30s, up to 200 at 60s+.
- **Technical accuracy report** — New `ACCURACY.md` documenting all measurement methodology, algorithms, standards, and architecture.
- **Project CLAUDE.md** — Comprehensive project guide for AI-assisted development.

### Changed

- **Full duration per provider** — In aggregated mode, each provider now gets the full user-configured test duration (e.g., 30s each = 60s total) instead of being halved (was 15s each). Accuracy over speed.
- **Confidence-weighted aggregation** — Replaced naive `(a + b) / 2` averaging with methodology-appropriate weights. Cloudflare gets 60% weight for bandwidth (multi-request, many samples), NDT7 gets 60% weight for latency (kernel-level TCPInfo.MinRTT).
- **Bandwidth accuracy pipeline** — Raw samples from both providers now go through: (1) slow-start discard (first 30%), (2) IQR outlier filtering, (3) modified trimean computation. Replaces simple percentile-based reporting.
- **Cloudflare `bandwidthPercentile`** — Changed from 0.9 (90th percentile, optimistic) to 0.5 (median, representative) for more accurate bandwidth reporting.
- **Cloudflare `bandwidthMinRequestDuration`** — Raised from 10ms to 50ms to ignore very short requests with disproportionate HTTP overhead.
- **Cloudflare loaded latency** — Probe interval reduced from 400ms to 200ms, max data points increased from 20 to 50 for better bufferbloat detection granularity.
- **NDT7 provider** — Now collects raw bandwidth samples (MeanClientMbps per callback) and computes latency stats from RTT samples for post-processing with the statistics module.
- **DnsBar** — Updated for 12 domains. Detail overlay now shows DNS/TCP/TLS/TTFB columns on desktop. Summary footer includes per-component averages.

## [1.4.1] — 2026-03-29

### Fixed

- **Pretext text vibration bug** — Replaced `ResizeObserver` in `useContainerWidth.ts` with synchronous `clientWidth` measurement + `window.resize` listener coalesced via a single `requestAnimationFrame` gate. ResizeObserver caused infinite feedback loops when combined with PretextBlock's shrinkwrap `max-width`, resulting in visible text vibration/oscillation. The new approach follows Pretext's own demo rendering architecture. Same API signature — no consumer changes needed.

## [1.4.0] — 2026-03-29

### Added

- **Pretext text measurement integration** — Integrated `@chenglou/pretext` for container-aware text measurement that eliminates layout shift during speed tests. Uses Canvas `measureText()` to predict text height without DOM reflow, then applies purely additive `minHeight` constraints via inline styles.
- **PretextProvider** — React context that waits for Inter font loading, prepares worst-case text entries via pretext's two-phase architecture (prepare once, layout on every resize at ~0.0002ms per entry), and exposes `getLayout()` to consumers.
- **PretextBlock component** — Drop-in wrapper that observes container width via ResizeObserver and applies `minHeight` from pretext measurement. Falls back to zero style additions if pretext isn't ready. Never touches grid, flex, display, padding, margin, or font properties.
- **useContainerWidth hook** — ResizeObserver-based hook returning content-box width of a referenced element in pixels.
- **Pretext text registry** — Centralized registry mapping worst-case representative strings (e.g., `"8888"` for speed numbers with `tabular-nums`) to font configs per breakpoint for stable height reservation.

### Changed

- **DataRow** — Speed number displays now wrapped in PretextBlock for stable height during value transitions (`"---"` to actual numbers)
- **DataPanel** — Ping and jitter number displays wrapped in PretextBlock for consistent SplitRow height
- **SysInfo** — Uses pretext measurement for `minHeight` reservation, preventing left panel height jumps at intermediate widths
- **tsconfig.json** — Added `ES2022.Intl` to lib array for `Intl.Segmenter` type definitions (required by pretext)

---

## [1.3.2] — 2026-03-09

### Fixed

- **DNS probe `perplexity.ai` always failing** — Replaced with `netflix.com` which reliably responds to `no-cors` fetch across all browsers

---

## [1.3.1] — 2026-03-09

### Fixed

- **NDT7 zero download/ping in aggregated mode** — `downloadComplete` and `uploadComplete` callbacks now extract `LastClientMeasurement` / `LastServerMeasurement` data as fallbacks when streaming measurements are missed (e.g. worker timeout)
- **NDT7 server-source download fallback** — Computes download throughput from server-reported `NumBytes`/`ElapsedTime` when client measurements are unavailable
- **Cloudflare packet loss error kills entire test** — `onError` firing during TURN credential failure (packet loss phase) would reject the promise and discard valid download/upload/latency results from `onFinish`. Error rejection is now deferred 2s to let `onFinish` resolve first.
- **Silent Cloudflare failures in aggregated mode** — Catch blocks no longer swallow errors silently; failures are logged to console with `[Cloudflare]`/`[Aggregated]` prefixes
- **Cloudflare connection interference** — CF engine is now explicitly stopped after completion before NDT7 starts, preventing potential connection conflicts

### Added

- **Diagnostic console logging** — All three providers (`[Cloudflare]`, `[NDT7]`, `[Aggregated]`) now log key events: server selection, phase completions, final results, and errors to the browser console for debugging

---

## [1.3.0] — 2026-03-09

### Removed

- **Test history section** from settings — results are session-only, no persistent localStorage history needed
- **`useTestHistory` hook** and all localStorage persistence for test results

### Fixed

- **Settings layout shift** when switching providers — Data Policy section now smoothly animates in/out instead of causing content to jump

---

## [1.2.0] — 2026-03-09

### Added

- **Copyright footer** — "© 2026 QUBETX" in light gray small text at the bottom of both main and settings pages
- **QubeTX favicon** — Custom favicon with white QubeTX logo on a rounded terra cotta background, replacing the SHAUGHV personal brandmark

### Fixed

- **12-hour time format** — Clock now displays 12-hour time with AM/PM instead of 24-hour format
- **Settings page mobile layout** — Removed 400px maxHeight scroll box, allowed Apparatus overflow on mobile, and aligned settings page to top so all sections are naturally scrollable
- **Cloudflare zero results** — Final breakdown no longer shows 0 for download/upload; tracks last known good values from progress callbacks as fallback when `getSummary()` returns undefined
- **Complete state mobile overflow** — Reclaimed ~60px on mobile by tightening breakdown margins, split-row gap, data-row padding, and action-button spacing
- **Settings gear overlap** — Moved gear button from absolute positioning to inline flow next to SysInfo text so it no longer overlays the speaker grill dots
- **Settings gear on error state** — Settings button now visible during error state in addition to idle and complete
- **Misleading "4G" on desktop** — Network info no longer shows bare "4G" (effectiveType) on desktop WiFi/Ethernet; shows bandwidth and RTT instead. Physical connection type (WiFi, Cellular, Ethernet) only shown when the browser provides it

---

## [1.1.8] — 2026-03-09

### Fixed

- **Asymmetric tape mechanism rails** — Centered reels horizontally within the mechanism container so the vertical rail lines have equal spacing on both sides. The 142px reels no longer left-align in the 154px content area.

---

## [1.1.7] — 2026-03-09

### Fixed

- **Tape reel compression on mobile** — Reduced reel size from 154px to 142px to eliminate 14px overflow within the mechanism container that caused the bottom reel to blend into the border. Bumped hub ratio (26% → 28%) and spoke width (2px → 3px) so the spoke lines render consistently at 0.65× mobile scale instead of flickering between 1px and 2px.

---

## [1.1.6] — 2026-03-09

### Fixed

- **Mobile viewport overflow** — Page was slightly taller than mobile browsers could display with native navbar. Fixed the TapeMechanism layout-box mismatch (CSS `transform: scale(0.65)` shrank it visually but not in layout, wasting ~112px), reduced mobile padding/margins throughout, and switched from `100dvh` to `100svh` (small viewport height) which accounts for all browser chrome. Verified zero overflow on Pixel 9 Pro, Pixel 9 Pro XL, iPhone 16/Pro/Pro Max, iPhone 17/Pro/Pro Max, iPhone SE, and small Android (360x640).

---

## [1.1.5] — 2026-03-09

### Fixed

- **Mobile layout clipping** — Mobile now uses `minHeight: 100dvh` with `overflow: auto` instead of fixed `height: 100dvh` + `overflow: hidden`, so all content (status text, tape mechanism, data panel) is fully visible and scrollable. Desktop/tablet remain viewport-locked.

---

## [1.1.4] — 2026-03-09

### Fixed

- **Provider transition overlay not appearing** — Simplified overlay logic to derive visibility directly from provider state instead of a `useState`/`useEffect` timer pattern that had a timing bug; the overlay now reliably appears for the full 3-second transition

---

## [1.1.3] — 2026-03-09

### Changed

- **Default test duration** — Changed from `auto` to `30` seconds per provider for more consistent results

---

## [1.1.2] — 2026-03-09

### Improved

- **Provider transition phase** — Extended to a deliberate 3-second pause between Cloudflare and M-Lab NDT7 with blurred background, detailed overlay showing checkmark + "CLOUDFLARE COMPLETE" → "M-LAB NDT7 STARTING", and an animated progress bar filling over the transition

---

## [1.1.1] — 2026-03-09

### Improved

- **Frosted glass play button** — Play icon in idle state now sits on a rounded, semi-transparent backdrop with blur so it's clearly visible against the tape reels
- **Provider labels during testing** — Active provider (`VIA CLOUDFLARE`, `VIA M-LAB NDT7`) shown as a separate line below the status text for better visibility
- **Provider-switch overlay** — Frosted glass popup with "CLOUDFLARE COMPLETE / SWITCHING TO M-LAB" shown briefly when transitioning between providers
- **AVG badge on results** — Download/Upload speed labels show a dark `AVG` badge when displaying aggregated results from both providers
- **Play button hidden on complete** — Play triangle no longer shows when the "RUN AGAIN" button is visible
- **Button/grill spacing** — Added margin between RUN AGAIN / RETRY buttons and the speaker grill matrix

### Fixed

- **Averaging math** — Jitter now properly averaged between providers (was using `||` which treated 0 as falsy); each metric averaged independently

---

## [1.1.0] — 2026-03-09

### Added

- **M-Lab consent modal** — Full-screen popup on first visit when provider is `both` or `ndt7` and data policy hasn't been accepted. Accept enables M-Lab; Decline falls back to Cloudflare-only.

### Fixed

- **"No signal" on every device** — Default provider `both` no longer errors when M-Lab consent isn't given; falls back to Cloudflare-only instead of showing error state
- **SysInfo/SpeakerGrill text overlap** — Removed absolute positioning from SysInfo; both components now flow in a bottom-anchored flex container
- **Desktop/tablet scroll overflow** — Changed page layout from `minHeight: 100dvh` to `height: 100dvh` with `overflow: hidden`; reduced desktop number sizes, padding, and tape mechanism height to fit within one viewport

---

## [1.0.1] — 2026-03-09

### Fixed

- SpeakerGrill now has `pointerEvents: 'none'` so it doesn't block clicks on buttons beneath it
- BACK button on settings page has proper z-index for reliable tap/click on all viewports

### Removed

- Conversation transcript file (prep for public repo)

### Added

- README with full project documentation, tech stack, structure, and settings reference
- CHANGELOG

---

## [1.0.0] — 2026-03-09

### Added

- **Dual-provider speed testing** — Runs Cloudflare and M-Lab NDT7 tests, defaulting to aggregated mode that averages results from both providers with per-provider breakdown
- **Cloudflare provider** — Download, upload, latency, jitter, and packet loss via `@cloudflare/speedtest`
- **M-Lab NDT7 provider** — Download, upload, and latency via `@m-lab/ndt7` with Web Workers
- **Aggregated provider** — Runs both providers sequentially, averages shared metrics, and displays per-provider values in smaller text
- **Configurable test duration** — Auto (default), 15s, 30s, 1m, 2m, 5m, 10m
- **Responsive layout** — Desktop (900px+), tablet (600–899px), and mobile (<600px) breakpoints with orientation support
- **Tape reel mechanism** — Cassette-style animation with spin speed linked to real-time throughput; pulses during latency phase, stops on idle/complete
- **Data panel** — Live ping, jitter, download speed, and upload speed metrics with progress bars and phase-aware status labels
- **Error state** — CRT scanline overlay, glitch text effects, and system diagnostic display on connection failure
- **Results stamp** — "TEST COMPLETE" rotated stamp overlay with stamp-in animation, z-layered above mechanism but below buttons
- **Settings view** — Provider selection (Both/Cloudflare/NDT7), M-Lab data policy consent, test duration, display units (Auto/Mbps/Kbps/Gbps), auto-copy results toggle, sound effects toggle
- **Network info** — Connection type, effective type, estimated bandwidth, and RTT from `navigator.connection` API (Chromium browsers)
- **Test history** — Last 50 results persisted to localStorage, viewable in settings with clear option
- **Custom SVG icons** — Gear and refresh icons generated via Quiver AI Arrow model to match QubeTX industrial brand aesthetic
- **QubeTX branding** — Logo in top bar, SHAUGHV favicons (light/dark variants), "Built by QubeTX" credit in system info
- **React Router** — `/` for main speed test, `/settings` for configuration
- **React Context state management** — Shared state across views via `SpeedTestContext`
- **Theme system** — Design tokens (colors, typography, borders) and responsive breakpoint values
- **Vite + React 18 + TypeScript** — Modern build toolchain with hot module replacement
