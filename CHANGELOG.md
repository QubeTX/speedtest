# Changelog

All notable changes to this project will be documented in this file.

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
