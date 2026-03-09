import SpeedTestEngine from '@cloudflare/speedtest';
import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';

function buildMeasurements(duration: TestDuration) {
  // Default measurements for 'auto'
  const defaults = [
    { type: 'latency' as const, numPackets: 20 },
    { type: 'download' as const, bytes: 1e5, count: 1, bypassMinDuration: true },
    { type: 'download' as const, bytes: 1e5, count: 8 },
    { type: 'download' as const, bytes: 1e6, count: 6 },
    { type: 'download' as const, bytes: 1e7, count: 4 },
    { type: 'upload' as const, bytes: 1e5, count: 8 },
    { type: 'upload' as const, bytes: 1e6, count: 6 },
    { type: 'upload' as const, bytes: 1e7, count: 4 },
    { type: 'packetLoss' as const, numPackets: 1000 },
  ];

  if (duration === 'auto') return defaults;

  // Scale measurements to fill requested duration
  const seconds = typeof duration === 'number' ? duration : 30;
  const factor = Math.max(1, Math.round(seconds / 30));

  return [
    { type: 'latency' as const, numPackets: 20 * factor },
    { type: 'download' as const, bytes: 1e5, count: 1, bypassMinDuration: true },
    { type: 'download' as const, bytes: 1e5, count: 8 * factor },
    { type: 'download' as const, bytes: 1e6, count: 6 * factor },
    { type: 'download' as const, bytes: 1e7, count: 4 * factor },
    { type: 'upload' as const, bytes: 1e5, count: 8 * factor },
    { type: 'upload' as const, bytes: 1e6, count: 6 * factor },
    { type: 'upload' as const, bytes: 1e7, count: 4 * factor },
    { type: 'packetLoss' as const, numPackets: 1000 },
  ];
}

export class CloudflareProvider implements SpeedTestProvider {
  name = 'Cloudflare';
  supportsPacketLoss = true;
  requiresConsent = false;

  private engine: SpeedTestEngine | null = null;

  start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    return new Promise((resolve, reject) => {
      const measurements = buildMeasurements(duration);
      const totalDl = measurements.filter(m => m.type === 'download').reduce((s, m) => s + ('count' in m ? m.count : 0), 0);
      const totalUl = measurements.filter(m => m.type === 'upload').reduce((s, m) => s + ('count' in m ? m.count : 0), 0);
      let dlCount = 0;
      let ulCount = 0;
      let currentPhase = 'discovering';

      this.engine = new SpeedTestEngine({
        autoStart: false,
        measurements,
      });

      const engine = this.engine;

      engine.onResultsChange = ({ type }: { type: string }) => {
        const results = engine.results;

        if (type === 'latency') {
          currentPhase = 'latency';
        } else if (type === 'download') {
          currentPhase = 'download';
          dlCount++;
        } else if (type === 'upload') {
          currentPhase = 'upload';
          ulCount++;
        }

        const ping = results.getUnloadedLatency();
        const jitter = results.getUnloadedJitter();
        const dlBps = results.getDownloadBandwidth();
        const ulBps = results.getUploadBandwidth();
        const packetLoss = results.getPacketLoss();

        onProgress({
          phase: currentPhase as SpeedTestProgress['phase'],
          currentProvider: 'Cloudflare',
          ping: ping ?? null,
          jitter: jitter ?? null,
          downloadSpeed: dlBps !== undefined ? dlBps / 1e6 : null,
          uploadSpeed: ulBps !== undefined ? ulBps / 1e6 : null,
          packetLoss: packetLoss ?? null,
          downloadProgress: totalDl > 0 ? (dlCount / totalDl) * 100 : 0,
          uploadProgress: totalUl > 0 ? (ulCount / totalUl) * 100 : 0,
          serverName: 'Cloudflare Edge',
          error: null,
        });
      };

      engine.onFinish = (results) => {
        const summary = results.getSummary();
        resolve({
          provider: 'cloudflare',
          ping: summary.latency ?? 0,
          jitter: summary.jitter ?? 0,
          downloadSpeed: (summary.download ?? 0) / 1e6,
          uploadSpeed: (summary.upload ?? 0) / 1e6,
          packetLoss: summary.packetLoss ?? null,
          serverName: 'Cloudflare Edge',
          timestamp: Date.now(),
        });
      };

      engine.onError = (error: string) => {
        reject(new Error(error));
      };

      onProgress({
        phase: 'discovering',
        currentProvider: 'Cloudflare',
        ping: null,
        jitter: null,
        downloadSpeed: null,
        uploadSpeed: null,
        packetLoss: null,
        downloadProgress: 0,
        uploadProgress: 0,
        serverName: 'Cloudflare Edge',
        error: null,
      });

      engine.play();
    });
  }

  stop() {
    if (this.engine) {
      this.engine.pause();
      this.engine = null;
    }
  }
}
