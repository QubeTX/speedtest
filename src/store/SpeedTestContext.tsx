import { createContext, useContext, type ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSpeedTest } from '../hooks/useSpeedTest';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult, NetworkMetadata } from '../types/speedtest';

interface SpeedTestContextValue {
  // Test state
  phase: TestPhase;
  progress: SpeedTestProgress;
  result: SpeedTestResult | null;
  dnsCheck: DnsCheckResult | null;
  networkMetadata: NetworkMetadata | null;

  // Actions
  startTest: () => Promise<void>;
  stopTest: () => void;
  resetTest: () => void;

  // Settings
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SpeedTestContextValue | null>(null);

export function SpeedTestProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const { phase, progress, result, dnsCheck, networkMetadata, startTest, stopTest, resetTest } = useSpeedTest(settings);

  const value: SpeedTestContextValue = {
    phase,
    progress,
    result,
    dnsCheck,
    networkMetadata,
    startTest,
    stopTest,
    resetTest,
    settings,
    updateSettings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpeedTestContext(): SpeedTestContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSpeedTestContext must be used within SpeedTestProvider');
  return ctx;
}
