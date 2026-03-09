import { useState, useCallback, useRef } from 'react';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, Settings } from '../types/speedtest';
import { initialProgress } from '../types/speedtest';
import { createProvider } from '../services/provider-factory';
import type { SpeedTestProvider as IProvider } from '../types/speedtest';

export function useSpeedTest(settings: Settings, onComplete: (result: SpeedTestResult) => void) {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [progress, setProgress] = useState<SpeedTestProgress>(initialProgress());
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const providerRef = useRef<IProvider | null>(null);

  const startTest = useCallback(async () => {
    // If NDT7 consent not given, fall back to cloudflare-only
    const effectiveMode = (settings.providerMode === 'ndt7' || settings.providerMode === 'both') && !settings.dataPolicyAccepted
      ? 'cloudflare'
      : settings.providerMode;

    setPhase('discovering');
    setResult(null);
    setProgress({ ...initialProgress(), phase: 'discovering' });

    const provider = createProvider(effectiveMode);
    providerRef.current = provider;

    try {
      const testResult = await provider.start((p) => {
        setPhase(p.phase);
        setProgress(p);
      }, settings.testDuration);

      setPhase('complete');
      setResult(testResult);
      setProgress(prev => ({
        ...prev,
        phase: 'complete',
        downloadProgress: 100,
        uploadProgress: 100,
      }));

      // Copy to clipboard if enabled
      if (settings.autoCopyResults) {
        const summary = `Speed Test Results\nDownload: ${testResult.downloadSpeed.toFixed(1)} Mbps\nUpload: ${testResult.uploadSpeed.toFixed(1)} Mbps\nPing: ${testResult.ping.toFixed(0)} ms\nJitter: ${testResult.jitter.toFixed(0)} ms`;
        navigator.clipboard?.writeText(summary).catch(() => {});
      }

      onComplete(testResult);
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
  }, []);

  const resetTest = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setProgress(initialProgress());
  }, []);

  return { phase, progress, result, startTest, stopTest, resetTest };
}
