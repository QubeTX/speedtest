import { useState, useCallback } from 'react';
import type { SpeedTestResult } from '../types/speedtest';

const STORAGE_KEY = 'qubetx-speedtest-history';
const MAX_RESULTS = 50;

function loadHistory(): SpeedTestResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(results: SpeedTestResult[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch { /* ignore */ }
}

export function useTestHistory() {
  const [history, setHistory] = useState<SpeedTestResult[]>(loadHistory);

  const addResult = useCallback((result: SpeedTestResult) => {
    setHistory(prev => {
      const next = [result, ...prev].slice(0, MAX_RESULTS);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addResult, clearHistory };
}
