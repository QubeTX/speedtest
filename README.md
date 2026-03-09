# QubeTX Speed Test

A dual-provider internet speed test with a retro cassette tape UI, built with React and TypeScript.

![QubeTX](https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg)

## Features

- **Dual-provider testing** — Cloudflare + M-Lab NDT7, aggregated by default with per-provider breakdown
- **Live metrics** — Ping, jitter, download speed, upload speed, and packet loss
- **Tape reel animation** — Spin speed linked to real-time throughput
- **Responsive** — Desktop, tablet, and mobile with portrait/landscape support
- **Configurable** — Test duration (auto to 10 min), speed units, provider selection
- **Test history** — Last 50 results stored locally

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router v7](https://reactrouter.com/)
- [@cloudflare/speedtest](https://www.npmjs.com/package/@cloudflare/speedtest) — Latency, jitter, packet loss, download, upload
- [@m-lab/ndt7](https://www.npmjs.com/package/@m-lab/ndt7) — Google-backed latency, download, upload

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
│   ├── data/         # DataPanel, DataRow, SplitRow, ProgressBar
│   ├── effects/      # ResultsStamp, GlitchText, CRTOverlay
│   ├── layout/       # Apparatus, TopBar, SpeakerGrill, SysInfo
│   ├── mechanism/    # TapeReel, TapeMechanism
│   └── ui/           # ActionButton, NetworkBadge
├── hooks/            # useClock, useResponsive, useSpeedTest, useSettings, etc.
├── services/         # Provider adapters (Cloudflare, NDT7, Aggregated)
├── store/            # SpeedTestContext (React Context)
├── theme/            # Design tokens and responsive breakpoints
├── types/            # TypeScript interfaces and type declarations
├── views/            # MainTestView, SettingsView
└── pages/            # Route wrappers
```

## How It Works

1. **Idle** — Tape reels are still, "PRESS TO START" displayed
2. **Testing** — Reels spin at a speed proportional to throughput; runs Cloudflare first, then NDT7
3. **Complete** — "TEST COMPLETE" stamp appears, averaged results shown with per-provider breakdown
4. **Error** — CRT glitch effects with system diagnostics

In aggregated mode (default), shared metrics are averaged between providers. Packet loss comes from Cloudflare only. ISP name comes from Cloudflare metadata.

## Settings

| Setting | Default | Options |
|---------|---------|---------|
| Provider | Both (Aggregated) | Both, Cloudflare, M-Lab NDT7 |
| Duration | Auto | Auto, 15s, 30s, 1m, 2m, 5m, 10m |
| Units | Auto | Auto, Mbps, Kbps, Gbps |
| Auto-copy | Off | On/Off |
| Sound effects | Off | On/Off |

M-Lab NDT7 requires accepting their data collection policy before testing.

## Branding

Built by [QubeTX](https://qubetx.com) — a department of ES Development LLC.

Custom SVG icons generated with [Quiver AI](https://quiver.ai) Arrow model.

---

![SHAUGHV](https://shaughv.s3.us-east-1.amazonaws.com/brandmark/SHAUGHV-Official.svg)
