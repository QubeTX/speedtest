# Changelog

All notable changes to this project will be documented in this file.

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
