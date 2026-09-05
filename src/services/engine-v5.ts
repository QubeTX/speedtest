// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import type { SpeedTestProvider, SpeedTestProgress, SpeedTestResult, TestProfile, ResultPlatform, ProviderRunResult } from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { RunBudget, httpTransfer, locateMlab, locateSupplementary, websocketTransfer } from './acquisition-v5';
import { estimateTrace, summarizeTraces, latencyStatistics as computeLatencyStats, METHODOLOGY_VERSION, PROFILES, type MeasurementTrace, type Direction, type StopReason } from './measurement-v5';

export interface EngineOptions { profile?: TestProfile; consent?: boolean; maxBytes?: number; platform?: ResultPlatform }
const REFERENCE = 'https://speed.cloudflare.com/__down?bytes=0';
const LABELS: Record<string, string> = { cloudflare: 'Cloudflare', msak: 'M-Lab MSAK', ndt7: 'M-Lab NDT7 · single stream', librespeed: 'LibreSpeed', cachefly: 'CacheFly', vultr: 'Vultr', fastcom: 'fast.com · supplementary' };
type Source = keyof typeof LABELS & ('cloudflare' | 'msak' | 'ndt7' | 'librespeed' | 'cachefly' | 'vultr' | 'fastcom');

/** One shared run owner; native adapters only forward lifecycle and result messages. */
export class V5Provider implements SpeedTestProvider {
  name = 'SpeedQX'; supportsPacketLoss = false; requiresConsent = true;
  private budget?: RunBudget;
  constructor(private options: EngineOptions = {}) {}
  stop(reason: StopReason = 'cancelled') { this.budget?.stop(reason); }
  async start(onProgress: (progress: SpeedTestProgress) => void): Promise<SpeedTestResult> {
    this.stop();
    const profile = this.options.profile ?? 'fast', policy = PROFILES[profile];
    const requested = this.options.maxBytes ?? policy.defaultMaxBytes;
    if (!Number.isSafeInteger(requested) || requested < 1) throw new Error('Data limit must be a positive whole number of bytes');
    const budget = new RunBudget(requested, policy.capMs); this.budget = budget;
    const traces: MeasurementTrace[] = [], providers: ProviderRunResult[] = [], warnings: string[] = [];
    const idle: number[] = [], loaded: Record<Direction, number[]> = { download: [], upload: [] };
    const failures = { idle: 0, download: 0, upload: 0 }, attempts = { idle: 0, download: 0, upload: 0 };
    let progress = initialProgress();
    let currentBytes = 0;
    const emit = (patch: Partial<SpeedTestProgress>) => { progress = { ...progress, ...patch, runData: {
      confirmedBytes: traces.reduce((n, t) => n + (t.points[t.points.length - 1]?.bytes ?? 0), 0) + currentBytes,
      budgetBytes: budget.used, byteLimit: budget.limit, elapsedMs: performance.now() - budget.started,
    } }; onProgress(progress); };
    const hidden = () => { if (document.hidden) budget.stop('background'); };
    const changed = () => budget.stop('network-change');
    const connection = (navigator as Navigator & { connection?: EventTarget & { type?: string } }).connection;
    const initialNetworkType = connection?.type;
    // Effective throughput/RTT changes during a test are not network transitions.
    const connectionChanged = () => { if (initialNetworkType && connection?.type !== initialNetworkType) changed(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('offline', changed); connection?.addEventListener('change', connectionChanged);
    const probe = async (kind: 'idle' | Direction, signal: AbortSignal) => {
      if (signal.aborted) return;
      const controller = new AbortController(), abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, 1500), start = performance.now();
      try {
        const response = await fetch(`${REFERENCE}&sqx=${Math.random()}`, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('Probe refused');
        await response.arrayBuffer();
        if (signal.aborted) return;
        attempts[kind]++;
        (kind === 'idle' ? idle : loaded[kind]).push(performance.now() - start);
      } catch { if (!signal.aborted) { attempts[kind]++; failures[kind]++; } }
      finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
    };
    const delay = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
      if (signal.aborted) { resolve(); return; }
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
      const timer = setTimeout(finish, ms); signal.addEventListener('abort', finish, { once: true });
    });
    try {
      hidden();
      emit({ phase: 'latency', currentProvider: 'Latency Engine' });
      // One connection warm-up, then a common bounded idle HTTP reference sample.
      await probe('idle', budget.signal); idle.length = 0; attempts.idle = 0; failures.idle = 0;
      for (let i = 0; i < 12 && !budget.signal.aborted; i++) {
        await probe('idle', budget.signal);
        if (idle.length) { const stats = computeLatencyStats(idle); emit({ ping: stats.p50, jitter: stats.p95 - stats.p50 }); }
        await delay(100, budget.signal);
      }
      const plan = this.options.consent ? ['cloudflare', 'msak'] : ['cloudflare'];
      if (!this.options.consent) warnings.push('M-Lab omitted: data publication consent not granted');
      let mlabRefused = false;
      const mlabEndpoints = new Map<string, Awaited<ReturnType<typeof locateMlab>>>();
      const runSource = async (key: Source, duration: number) => {
        if (budget.signal.aborted) return;
        const mlab = key === 'msak' || key === 'ndt7';
        if (mlab && mlabRefused) { warnings.push(`${LABELS[key]} skipped after M-Lab rate limit`); return; }
        emit({ phase: 'discovering', currentProvider: LABELS[key], downloadProgress: 0, uploadProgress: 0, downloadSpeed: null, uploadSpeed: null });
        const first = traces.length;
        let server = 'speed.cloudflare.com';
        try {
          const endpoints = key === 'cloudflare'
            ? { download: 'https://speed.cloudflare.com/__down', upload: 'https://speed.cloudflare.com/__up' }
            : mlab ? mlabEndpoints.get(key) ?? await locateMlab(key, duration, budget) : await locateSupplementary(key, budget);
          if (mlab && 'machine' in endpoints && endpoints.upload) mlabEndpoints.set(key, { machine: endpoints.machine, download: endpoints.download, upload: endpoints.upload });
          if ('machine' in endpoints) server = endpoints.machine;
          for (const direction of ['download', 'upload'] as const) {
            if (budget.signal.aborted) break;
            const endpoint = endpoints[direction]; if (!endpoint) continue;
            emit({ phase: direction, serverName: server });
            const probeOwner = new AbortController(), stopProbes = () => probeOwner.abort();
            budget.signal.addEventListener('abort', stopProbes, { once: true });
            const probing = (async () => { while (!probeOwner.signal.aborted) { await probe(direction, probeOwner.signal); await delay(500, probeOwner.signal); } })();
            try {
              const live = (rate: number, pct: number, confirmedBytes: number) => { currentBytes = confirmedBytes; emit(direction === 'download' ? { downloadSpeed: rate, downloadProgress: pct } : { uploadSpeed: rate, uploadProgress: pct }); };
              const output = mlab
                ? await websocketTransfer(key, endpoint, direction, duration, budget, live)
                : await httpTransfer(key, endpoint, direction, duration, budget, live);
              traces.push(output.trace);
              currentBytes = 0;
            } finally { currentBytes = 0; stopProbes(); await probing; budget.signal.removeEventListener('abort', stopProbes); }
          }
        } catch (error) { const message = error instanceof Error ? error.message : 'unavailable'; if (mlab && message.includes('429')) mlabRefused = true; warnings.push(`${LABELS[key]}: ${message}`); }
        const source = traces.slice(first), dl = source.find(t => t.direction === 'download'), ul = source.find(t => t.direction === 'upload');
        const d = dl && estimateTrace(dl), u = ul && estimateTrace(ul);
        providers.push({ provider: key, name: LABELS[key], server, availability: d?.sustainedMbps != null || u?.sustainedMbps != null ? 'ran' : 'failed', pingMs: null,
          downloadMbps: d?.sustainedMbps ?? null, uploadMbps: u?.sustainedMbps ?? null,
          samples: { download: d?.samples ?? 0, upload: u?.samples ?? 0 },
          bytes: { download: dl?.points[dl.points.length - 1]?.bytes ?? 0, upload: ul?.points[ul.points.length - 1]?.bytes ?? 0 } });
        await delay(500, budget.signal);
      };
      for (let round = 0; round < (profile === 'full' ? 2 : 1); round++) for (const key of plan) await runSource(key as 'cloudflare' | 'msak', policy.directionMs);
      if (this.options.consent) await runSource('ndt7', 10_000);
      if (profile === 'full') for (const key of ['librespeed', 'cachefly', 'vultr', 'fastcom'] as const) await runSource(key, 10_000);
    } finally {
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('offline', changed); connection?.removeEventListener('change', connectionChanged);
      budget.dispose(); if (this.budget === budget) this.budget = undefined;
    }
    const download = summarizeTraces(traces, 'download'), upload = summarizeTraces(traces, 'upload');
    const latencyStats = idle.length ? computeLatencyStats(idle) : undefined;
    const result: SpeedTestResult = {
      provider: this.name, methodologyVersion: METHODOLOGY_VERSION, platform: this.options.platform ?? 'web', providerSet: profile,
      ping: latencyStats?.p50 ?? 0, jitter: latencyStats ? latencyStats.p95 - latencyStats.p50 : 0,
      downloadSpeed: download.estimate.sustainedMbps ?? 0, uploadSpeed: upload.estimate.sustainedMbps ?? 0,
      packetLoss: null, serverName: 'Cloudflare HTTP reference', timestamp: Date.now(), latencyStats, providers,
      measurement: { download: download.estimate, upload: upload.estimate, primaryProviders: { download: download.providers, upload: upload.providers }, traces,
        bytesTransferred: traces.reduce((total, t) => total + (t.points[t.points.length - 1]?.bytes ?? 0), 0), budgetBytes: budget.used, byteLimit: budget.limit,
        elapsedMs: performance.now() - budget.started, stopReason: budget.reason },
      httpLatency: { endpoint: REFERENCE, idle, download: loaded.download, upload: loaded.upload, failures, attempts },
      warnings: [...new Set([...warnings, ...download.estimate.warnings, ...upload.estimate.warnings, ...(budget.reason !== 'complete' ? [`Run ended: ${budget.reason}`] : [])])],
    };
    emit({ phase: 'complete', downloadSpeed: result.downloadSpeed, uploadSpeed: result.uploadSpeed });
    return result;
  }
}
