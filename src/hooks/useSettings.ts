import { useState, useCallback } from 'react';
import { type Settings, DEFAULT_SETTINGS } from '../types/speedtest';

const STORAGE_KEY = 'qubetx-speedtest-settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      // v4 migrations for settings whose UI no longer exists:
      // - provider picker removed — a stored single-provider mode would silently
      //   constrain the engine with no way to change it back. Force the registry.
      // - duration is now per-source (DEEP TEST runs sources sequentially), so
      //   legacy 2/5/10-minute values are clamped to the 1-minute ceiling.
      loaded.providerMode = 'both';
      if (typeof loaded.testDuration === 'number' && loaded.testDuration > 60) {
        loaded.testDuration = 60;
      }
      return loaded;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
