import { useState, useCallback } from 'react';
import { type Settings, DEFAULT_SETTINGS } from '../types/speedtest';

const STORAGE_KEY = 'qubetx-speedtest-settings';

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
