import { useEffect, useState } from 'react';

// Detect iPhone, iPad, and iPod Touch. iPadOS 13+ reports a "Macintosh"
// user agent to request desktop-class sites; the maxTouchPoints check
// disambiguates it from real Macs (which report maxTouchPoints === 0).
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (/Mac/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

export function useIsIOS(): boolean {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(detectIOS());
  }, []);

  return isIOS;
}
