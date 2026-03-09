import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestDuration } from '../types/speedtest';
import { CloudflareProvider } from './cloudflare-provider';
import { NDT7Provider } from './ndt7-provider';

export class AggregatedProvider implements SpeedTestProvider {
  name = 'Both (Aggregated)';
  supportsPacketLoss = true;
  requiresConsent = true; // NDT7 requires consent

  private cf = new CloudflareProvider();
  private ndt = new NDT7Provider();
  private stopped = false;

  async start(onProgress: (p: SpeedTestProgress) => void, duration: TestDuration = 'auto'): Promise<SpeedTestResult> {
    this.stopped = false;

    // Split duration for each provider
    const perProviderDuration: TestDuration = duration === 'auto'
      ? 'auto'
      : (typeof duration === 'number' ? Math.max(15, Math.round(duration / 2)) as TestDuration : 'auto');

    // Phase 1: Cloudflare (progress 0-50%)
    let cfResult: SpeedTestResult;
    try {
      cfResult = await this.cf.start((p) => {
        if (this.stopped) return;
        onProgress({
          ...p,
          currentProvider: 'Cloudflare',
          downloadProgress: p.downloadProgress * 0.5,
          uploadProgress: p.uploadProgress * 0.5,
        });
      }, perProviderDuration);
    } catch (err) {
      // If Cloudflare fails, still try NDT7
      cfResult = {
        provider: 'cloudflare',
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        packetLoss: null,
        serverName: 'Cloudflare Edge',
        timestamp: Date.now(),
      };
    }

    if (this.stopped) throw new Error('Test stopped');

    // Phase 2: NDT7 (progress 50-100%)
    let ndtResult: SpeedTestResult;
    try {
      ndtResult = await this.ndt.start((p) => {
        if (this.stopped) return;
        onProgress({
          ...p,
          currentProvider: 'M-Lab NDT7',
          // Merge Cloudflare's latency data while NDT runs
          ping: p.ping ?? cfResult.ping,
          jitter: p.jitter ?? cfResult.jitter,
          downloadProgress: 50 + p.downloadProgress * 0.5,
          uploadProgress: 50 + p.uploadProgress * 0.5,
        });
      }, perProviderDuration);
    } catch (err) {
      ndtResult = {
        provider: 'ndt7',
        ping: 0,
        jitter: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        packetLoss: null,
        serverName: 'M-Lab Server',
        timestamp: Date.now(),
      };
    }

    // Average results
    const hasCf = cfResult.downloadSpeed > 0;
    const hasNdt = ndtResult.downloadSpeed > 0;
    const divisor = (hasCf && hasNdt) ? 2 : 1;

    const avgDl = ((hasCf ? cfResult.downloadSpeed : 0) + (hasNdt ? ndtResult.downloadSpeed : 0)) / divisor;
    const avgUl = ((hasCf ? cfResult.uploadSpeed : 0) + (hasNdt ? ndtResult.uploadSpeed : 0)) / divisor;
    const avgPing = ((hasCf ? cfResult.ping : 0) + (hasNdt ? ndtResult.ping : 0)) / divisor;

    return {
      provider: 'aggregated',
      ping: avgPing,
      jitter: cfResult.jitter || ndtResult.jitter, // Cloudflare's is more accurate
      downloadSpeed: avgDl,
      uploadSpeed: avgUl,
      packetLoss: cfResult.packetLoss,
      serverName: `CF Edge + ${ndtResult.serverName}`,
      timestamp: Date.now(),
      providerResults: {
        cloudflare: cfResult,
        ndt7: ndtResult,
      },
    };
  }

  stop() {
    this.stopped = true;
    this.cf.stop();
    this.ndt.stop();
  }
}
