import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { prepare, layout, type PreparedText } from '@chenglou/pretext';
import {
  textRegistry,
  remToPx,
  buildFontShorthand,
  type TextEntryConfig,
} from '../lib/pretext-registry';

interface PreparedEntry {
  prepared: PreparedText;
  lineHeightPx: number;
}

interface PretextContextValue {
  isReady: boolean;
  getLayout: (
    entryId: string,
    maxWidth: number,
  ) => { height: number; lineCount: number } | null;
}

const PretextContext = createContext<PretextContextValue>({
  isReady: false,
  getLayout: () => null,
});

export function usePretext(): PretextContextValue {
  return useContext(PretextContext);
}

function prepareAllEntries(
  registry: Record<string, TextEntryConfig>,
  rootFontSize: number,
): Map<string, PreparedEntry> {
  const entries = new Map<string, PreparedEntry>();

  for (const [id, config] of Object.entries(registry)) {
    const sizePx = remToPx(config.fontSizeRem, rootFontSize);
    const fontShorthand = buildFontShorthand(config.fontWeight, sizePx);
    const lineHeightPx = config.lineHeight * sizePx;
    const prepared = prepare(config.text, fontShorthand);
    entries.set(id, { prepared, lineHeightPx });
  }

  return entries;
}

interface PretextProviderProps {
  children: ReactNode;
}

export default function PretextProvider({ children }: PretextProviderProps) {
  const [entries, setEntries] = useState<Map<string, PreparedEntry> | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Wait for Inter font to be loaded
      await document.fonts.ready;

      // Verify Inter is actually available
      const fontLoaded = document.fonts.check('16px Inter');
      if (!fontLoaded) {
        // Inter not available yet -- still safe to proceed, measurements
        // will use the fallback font and be slightly off, but the site
        // renders fine. Re-check on subsequent font loads.
        console.warn('[Pretext] Inter font not detected, using fallback metrics');
      }

      if (cancelled) return;

      const rootFontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );

      const prepared = prepareAllEntries(textRegistry, rootFontSize);
      setEntries(prepared);
      setIsReady(true);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const getLayout = (
    entryId: string,
    maxWidth: number,
  ): { height: number; lineCount: number } | null => {
    if (!entries) return null;
    const entry = entries.get(entryId);
    if (!entry) return null;
    return layout(entry.prepared, maxWidth, entry.lineHeightPx);
  };

  return (
    <PretextContext.Provider value={{ isReady, getLayout }}>
      {children}
    </PretextContext.Provider>
  );
}
