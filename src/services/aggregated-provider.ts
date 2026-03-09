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
      console.warn('[Aggregated] Cloudflare failed:', err);
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

    console.log('[Aggregated] Cloudflare result:', { dl: cfResult.downloadSpeed, ul: cfResult.uploadSpeed, ping: cfResult.ping, jitter: cfResult.jitter });
    // Release CF connections before NDT7 starts
    this.cf.stop();

    if (this.stopped) throw new Error('Test stopped');

    // 3-second transition phase between providers
    onProgress({
      phase: 'discovering',
      currentProvider: 'Switching to M-Lab NDT7',
      ping: cfResult.ping,
      jitter: cfResult.jitter,
      downloadSpeed: null,
      uploadSpeed: null,
      packetLoss: cfResult.packetLoss,
      downloadProgress: 50,
      uploadProgress: 50,
      serverName: cfResult.serverName,
      error: null,
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
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
      console.warn('[Aggregated] NDT7 failed:', err);
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

    console.log('[Aggregated] NDT7 result:', { dl: ndtResult.downloadSpeed, ul: ndtResult.uploadSpeed, ping: ndtResult.ping, jitter: ndtResult.jitter });

    // Average results — compute per-metric to handle partial failures
    function avg(a: number, b: number): number {
      const hasA = a > 0;
      const hasB = b > 0;
      if (hasA && hasB) return (a + b) / 2;
      return hasA ? a : b;
    }

    const avgDl = avg(cfResult.downloadSpeed, ndtResult.downloadSpeed);
    const avgUl = avg(cfResult.uploadSpeed, ndtResult.uploadSpeed);
    const avgPing = avg(cfResult.ping, ndtResult.ping);
    const avgJitter = avg(cfResult.jitter, ndtResult.jitter);

    return {
      provider: 'aggregated',
      ping: avgPing,
      jitter: avgJitter,
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
