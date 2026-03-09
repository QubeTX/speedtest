# Changelog

All notable changes to this project will be documented in this file.

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
