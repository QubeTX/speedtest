import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';

export class NDT7Provider implements SpeedTestProvider {
  name = 'M-Lab NDT7';
  supportsPacketLoss = false;
  requiresConsent = true;

  private aborted = false;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.aborted = false;

    // NDT7 is a UMD module — import it dynamically
    const ndt7Module = await import('@m-lab/ndt7');
    const ndt7 = ndt7Module.default || ndt7Module;

    let serverName = 'M-Lab Auto';
    let lastPing: number | null = null;
    let lastDlSpeed: number | null = null;
    let lastUlSpeed: number | null = null;
    const rttSamples: number[] = [];

    // For duration-based iteration
    const seconds = duration === 'auto' ? 0 : (typeof duration === 'number' ? duration : 30);
    const iterations = seconds > 30 ? Math.ceil(seconds / 20) : 1;
    const allDlSpeeds: number[] = [];
    const allUlSpeeds: number[] = [];
    const allPings: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      if (this.aborted) break;

      await new Promise<void>((resolve, reject) => {
        const dlStartTime = Date.now();
        let ulStartTime = 0;

        ndt7.test(
          {
            userAcceptedDataPolicy: true,
            downloadworkerfile: '/ndt7-download-worker.js',
            uploadworkerfile: '/ndt7-upload-worker.js',
            metadata: {
              client_name: 'qubetx-speedtest',
              client_version: '1.0.0',
            },
          },
          {
            serverChosen: (server: { machine: string }) => {
              serverName = server.machine || 'M-Lab Server';
              onProgress({
                phase: 'discovering',
                currentProvider: 'M-Lab NDT7',
                ping: null,
                jitter: null,
                downloadSpeed: null,
                uploadSpeed: null,
                packetLoss: null,
                downloadProgress: 0,
                uploadProgress: 0,
                serverName,
                error: null,
              });
            },

            downloadMeasurement: (data: {
              Source: string;
              Data: {
                MeanClientMbps?: number;
                TCPInfo?: { MinRTT?: number; SmoothedRTT?: number };
                ElapsedTime?: number;
              };
            }) => {
              if (this.aborted) return;

              if (data.Source === 'client' && data.Data.MeanClientMbps !== undefined) {
                lastDlSpeed = data.Data.MeanClientMbps;
              }

              if (data.Source === 'server' && data.Data.TCPInfo?.MinRTT) {
                const rttMs = data.Data.TCPInfo.MinRTT / 1000; // µs → ms
                lastPing = rttMs;
                rttSamples.push(rttMs);
              }

              const elapsed = Date.now() - dlStartTime;
              const dlProgress = Math.min(100, (elapsed / 10000) * 100);

              onProgress({
                phase: 'download',
                currentProvider: 'M-Lab NDT7',
                ping: lastPing,
                jitter: computeJitter(rttSamples),
                downloadSpeed: lastDlSpeed,
                uploadSpeed: null,
                packetLoss: null,
                downloadProgress: dlProgress,
                uploadProgress: 0,
                serverName,
                error: null,
              });
            },

            downloadComplete: () => {
              if (lastDlSpeed !== null) allDlSpeeds.push(lastDlSpeed);
              if (lastPing !== null) allPings.push(lastPing);
              ulStartTime = Date.now();
              onProgress({
                phase: 'upload',
                currentProvider: 'M-Lab NDT7',
                ping: lastPing,
                jitter: computeJitter(rttSamples),
                downloadSpeed: lastDlSpeed,
                uploadSpeed: null,
                packetLoss: null,
                downloadProgress: 100,
                uploadProgress: 0,
                serverName,
                error: null,
              });
            },

            uploadMeasurement: (data: {
              Source: string;
              Data: {
                MeanClientMbps?: number;
                ElapsedTime?: number;
              };
            }) => {
              if (this.aborted) return;

              if (data.Source === 'client' && data.Data.MeanClientMbps !== undefined) {
                lastUlSpeed = data.Data.MeanClientMbps;
              }

              const elapsed = Date.now() - (ulStartTime || Date.now());
              const ulProgress = Math.min(100, (elapsed / 10000) * 100);

              onProgress({
                phase: 'upload',
                currentProvider: 'M-Lab NDT7',
                ping: lastPing,
                jitter: computeJitter(rttSamples),
                downloadSpeed: lastDlSpeed,
                uploadSpeed: lastUlSpeed,
                packetLoss: null,
                downloadProgress: 100,
                uploadProgress: ulProgress,
                serverName,
                error: null,
              });
            },

            uploadComplete: () => {
              if (lastUlSpeed !== null) allUlSpeeds.push(lastUlSpeed);
              resolve();
            },

            error: (err: string | Error) => {
              const msg = typeof err === 'string' ? err : err.message;
              reject(new Error(msg));
            },
          },
        );
      });
    }

    const avgDl = allDlSpeeds.length > 0 ? allDlSpeeds.reduce((a, b) => a + b, 0) / allDlSpeeds.length : (lastDlSpeed ?? 0);
    const avgUl = allUlSpeeds.length > 0 ? allUlSpeeds.reduce((a, b) => a + b, 0) / allUlSpeeds.length : (lastUlSpeed ?? 0);
    const avgPing = allPings.length > 0 ? allPings.reduce((a, b) => a + b, 0) / allPings.length : (lastPing ?? 0);

    return {
      provider: 'ndt7',
      ping: avgPing,
      jitter: computeJitter(rttSamples),
      downloadSpeed: avgDl,
      uploadSpeed: avgUl,
      packetLoss: null,
      serverName,
      timestamp: Date.now(),
    };
  }

  stop() {
    this.aborted = true;
  }
}

function computeJitter(samples: number[]): number {
  if (samples.length < 2) return 0;
  let totalDiff = 0;
  for (let i = 1; i < samples.length; i++) {
    totalDiff += Math.abs(samples[i] - samples[i - 1]);
  }
  return totalDiff / (samples.length - 1);
}
