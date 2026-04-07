# QubeTX Speed Test

A dual-provider internet speed test with a retro cassette tape UI, built with React and TypeScript.

![QubeTX](https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg)

## Features

- **Dual-provider testing** — Cloudflare + M-Lab NDT7, aggregated by default with confidence-weighted merge and per-provider breakdown
- **Technician-grade accuracy** — Ookla-style modified trimean, slow-start discard, IQR outlier filtering, and 100-sample dedicated latency engine
- **Latency percentiles** — P50, P75, P95, P99 breakdown with RFC 3550 jitter calculation
- **Bufferbloat detection** — Loaded vs unloaded latency comparison with A-F grading
- **Connection stability** — Coefficient of variation analysis for download/upload consistency
- **Provider divergence alerts** — Flags when Cloudflare and NDT7 disagree by >30% (indicates throttling/QoS)
- **Live metrics** — Ping, jitter, download speed, upload speed, and packet loss
- **Tape reel animation** — Spin speed linked to real-time throughput
- **Responsive** — Desktop, tablet, and mobile with portrait/landscape support; pretext-powered container-aware text measurement prevents layout shift
- **Configurable** — Test duration (auto to 10 min), speed units, provider selection
- **DNS / connectivity diagnostics** — Probes 12 domains in parallel with DNS/TCP/TLS/TTFB timing breakdown via Performance Resource Timing API
- **Network info** — Connection type, bandwidth estimate, and RTT from browser APIs
- **Auto-copy** — Optionally copy results to clipboard on completion (includes percentiles, bufferbloat grade, stability)

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router v7](https://reactrouter.com/)
- [@cloudflare/speedtest](https://www.npmjs.com/package/@cloudflare/speedtest) — Latency, jitter, packet loss, download, upload
- [@m-lab/ndt7](https://www.npmjs.com/package/@m-lab/ndt7) — Google-backed latency, download, upload
- [@chenglou/pretext](https://github.com/chenglou/pretext) — Container-aware text measurement for layout-shift prevention

## Getting Started

```bash
# Install dependencies (also copies NDT7 worker files to public/)
npm install

# Start dev server
npm run dev

# Production build
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── data/         # DataPanel, DataRow, SplitRow, ProgressBar, DnsBar
│   ├── effects/      # ResultsStamp, GlitchText, CRTOverlay
│   ├── layout/       # Apparatus, TopBar, SpeakerGrill, SysInfo
│   ├── mechanism/    # TapeReel, TapeMechanism
│   └── ui/           # ActionButton, ConsentModal, NetworkBadge, PretextBlock
├── hooks/            # useClock, useResponsive, useSpeedTest, useSettings, useNetworkInfo, useContainerWidth
├── lib/              # Pretext text registry and font helpers
├── providers/        # PretextProvider (font loading + text measurement context)
├── services/         # Provider adapters (Cloudflare, NDT7, Aggregated) + DNS checker
├── store/            # SpeedTestContext (React Context)
├── theme/            # Design tokens and responsive breakpoints
├── types/            # TypeScript interfaces and type declarations
├── views/            # MainTestView, SettingsView
└── pages/            # Route wrappers
```

## How It Works

1. **First visit** — M-Lab consent modal appears (accept enables dual-provider; decline uses Cloudflare-only)
2. **Idle** — Tape reels are still, frosted glass play button displayed
3. **Latency phase** — Dedicated engine sends 100 HTTP pings (3 warm-up discarded) with PerformanceResourceTiming precision
4. **Cloudflare phase** — Progressive payloads (100KB to 250MB) with concurrent loaded latency probes for bufferbloat detection
5. **NDT7 phase** — Single-stream WebSocket throughput with TCP kernel metrics (MinRTT)
6. **Aggregation** — Raw samples from both providers go through slow-start discard, IQR outlier filtering, and modified trimean. Results merged with confidence weights (CF 60% bandwidth / NDT7 60% latency).
7. **Complete** — "TEST COMPLETE" stamp appears with accuracy badges: bufferbloat grade, stability indicator, divergence warning
8. **Error** — CRT glitch effects with system diagnostics

Packet loss comes from Cloudflare only (UDP via TURN). See [ACCURACY.md](ACCURACY.md) for full methodology documentation.

## Settings

| Setting | Default | Options |
|---------|---------|---------|
| Provider | Both (Aggregated) | Both, Cloudflare, M-Lab NDT7 |
| Duration | 30s | Auto, 15s, 30s, 1m, 2m, 5m, 10m |
| Units | Auto | Auto, Mbps, Kbps, Gbps |
| Auto-copy | Off | On/Off |
| Sound effects | Off | On/Off |

M-Lab NDT7 requires accepting their data collection policy before testing.

## Branding

Built by [QubeTX](https://qubetx.com) — a department of ES Development LLC.

Custom SVG icons generated with [Quiver AI](https://quiver.ai) Arrow model.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

---

![SHAUGHV](https://shaughv.s3.us-east-1.amazonaws.com/brandmark/SHAUGHV-Official.svg)
