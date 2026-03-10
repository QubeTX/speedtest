import { useState, useCallback, useRef } from 'react';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult } from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { createProvider } from '../services/provider-factory';
import type { SpeedTestProvider as IProvider } from '../types/speedtest';
import { runDnsCheck } from '../services/dns-check';

export function useSpeedTest(settings: Settings, onComplete?: (result: SpeedTestResult) => void) {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [progress, setProgress] = useState<SpeedTestProgress>(initialProgress());
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [dnsCheck, setDnsCheck] = useState<DnsCheckResult | null>(null);
  const providerRef = useRef<IProvider | null>(null);

  const startTest = useCallback(async () => {
    // If NDT7 consent not given, fall back to cloudflare-only
    const effectiveMode = (settings.providerMode === 'ndt7' || settings.providerMode === 'both') && !settings.dataPolicyAccepted
      ? 'cloudflare'
      : settings.providerMode;

    setPhase('discovering');
    setResult(null);
    setDnsCheck(null);
    setProgress({ ...initialProgress(), phase: 'discovering' });

    const provider = createProvider(effectiveMode);
    providerRef.current = provider;

    // Fire DNS checks in background — don't block speed test
    const dnsPromise = runDnsCheck((partial) => setDnsCheck(partial))
      .catch((err) => {
        console.warn('[DNS Check] Failed:', err);
        return null;
      });

    try {
      const testResult = await provider.start((p) => {
        setPhase(p.phase);
        setProgress(p);
      }, settings.testDuration);

      // Wait for DNS checks to finish (they're fast, usually done by now)
      const dnsResult = await dnsPromise;

      const resultWithDns: SpeedTestResult = {
        ...testResult,
        ...(dnsResult ? { dnsCheck: dnsResult } : {}),
      };

      setPhase('complete');
      setResult(resultWithDns);
      setProgress(prev => ({
        ...prev,
        phase: 'complete',
        downloadProgress: 100,
        uploadProgress: 100,
      }));

      // Copy to clipboard if enabled
      if (settings.autoCopyResults) {
        let summary = `Speed Test Results\nDownload: ${testResult.downloadSpeed.toFixed(1)} Mbps\nUpload: ${testResult.uploadSpeed.toFixed(1)} Mbps\nPing: ${testResult.ping.toFixed(0)} ms\nJitter: ${testResult.jitter.toFixed(0)} ms`;

        if (dnsResult) {
          const passed = dnsResult.probes.filter(p => p.status === 'pass');
          summary += `\n\nConnectivity Diagnostics:`;
          for (const probe of dnsResult.probes) {
            summary += `\n${probe.domain}: ${probe.status === 'pass' ? `${probe.totalMs}ms` : 'FAIL'}`;
          }
          summary += `\n${passed.length}/${dnsResult.probes.length} passed`;
          if (dnsResult.avgTotalMs !== null) {
            summary += ` • avg ${dnsResult.avgTotalMs}ms`;
          }
        }

        navigator.clipboard?.writeText(summary).catch(() => {});
      }

      onComplete?.(resultWithDns);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPhase('error');
      setProgress(prev => ({ ...prev, phase: 'error', error: message }));
    } finally {
      providerRef.current = null;
    }
  }, [settings, onComplete]);

  const stopTest = useCallback(() => {
    providerRef.current?.stop();
    providerRef.current = null;
    setPhase('idle');
    setProgress(initialProgress());
    setDnsCheck(null);
  }, []);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setProgress(initialProgress());
    setDnsCheck(null);
  }, []);

  return { phase, progress, result, dnsCheck, startTest, stopTest, resetTest };
}
