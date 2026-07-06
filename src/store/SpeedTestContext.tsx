import { createContext, useContext, type ReactNode } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useSpeedTest, type ProviderStep } from '../hooks/useSpeedTest';
import type { TestPhase, SpeedTestProgress, SpeedTestResult, Settings, DnsCheckResult, NetworkMetadata, TestProfile } from '../types/speedtest';

interface SpeedTestContextValue {
  // Test state
  phase: TestPhase;
  progress: SpeedTestProgress;
  result: SpeedTestResult | null;
  dnsCheck: DnsCheckResult | null;
  networkMetadata: NetworkMetadata | null;
  /** Which provider (of how many) is currently running, or null when idle. */
  providerStep: ProviderStep | null;

  // Actions
  /** Start a run. Pass `'fast'`/`'full'` to override the stored default profile. */
  startTest: (profile?: TestProfile) => Promise<void>;
  /** Re-run using the most recent run's profile. */
  rerunTest: () => Promise<void>;
  /** Profile used by the most recent run (drives the alternate re-run button). */
  lastProfile: TestProfile;
  stopTest: () => void;
  resetTest: () => void;

  // Settings
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<SpeedTestContextValue | null>(null);

export function SpeedTestProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const { phase, progress, result, dnsCheck, networkMetadata, providerStep, startTest, rerunTest, stopTest, resetTest, lastProfile } = useSpeedTest(settings);

  const value: SpeedTestContextValue = {
    phase,
    progress,
    result,
    dnsCheck,
    networkMetadata,
    providerStep,
    startTest,
    rerunTest,
    lastProfile,
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
