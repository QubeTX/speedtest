import { useState, useRef, useEffect, useLayoutEffect, useId, useCallback, createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { tooltips, getRangeLabel } from '../../content/tooltips';
import { useIsWide } from '../../hooks/useResponsive';
import PretextBlock from './PretextBlock';

/* ─── Shared context: only one tooltip visible at a time ─── */

interface TooltipContextValue {
  activeId: string | null;
  open: (id: string) => void;
  close: (id: string) => void;
}

const TooltipContext = createContext<TooltipContextValue>({
  activeId: null,
  open: () => {},
  close: () => {},
});

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback((id: string) => setActiveId(id), []);
  const close = useCallback((id: string) => {
    setActiveId(prev => (prev === id ? null : prev));
  }, []);

  return (
    <TooltipContext.Provider value={{ activeId, open, close }}>
      {children}
    </TooltipContext.Provider>
  );
}

/* ─── Tooltip component ─── */

interface TooltipProps {
  tooltipKey: string;
  children: ReactNode;
  /** Metric value — used to show the relevant range label dynamically */
  value?: number;
  /** "inline" adds dotted underline; "badge" only adds cursor: help */
  variant?: 'inline' | 'badge';
  /** Pass-through style for the outermost wrapper span */
  style?: CSSProperties;
}

const SHOW_DELAY = 150;
const HIDE_DELAY = 300;

export default function Tooltip({ tooltipKey, children, value, variant = 'inline', style }: TooltipProps) {
  const entry = tooltips[tooltipKey];
  const id = useId();
  const { activeId, open, close } = useContext(TooltipContext);
  const isActive = activeId === id;

  // Fixed viewport coords for the portaled bubble. The bubble is rendered into
  // document.body so ancestor overflow:hidden (expander animations, panel
  // borders) can never clip it; null = "measuring" (rendered but invisible).
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    arrowLeft: number;
    placement: 'above' | 'below';
  } | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const isWide = useIsWide();
  // Narrow viewports are treated as touch: tap-to-open, ≥44px targets, outside-tap close.
  const isMobile = !isWide;
  const bodyVariant: 'wide' | 'narrow' = isWide ? 'wide' : 'narrow';

  const sizes = isWide
    ? { body: '0.8rem', title: '0.75rem', maxWidth: 340, padding: '0.75rem 1rem' }
    : { body: '0.65rem', title: '0.6rem', maxWidth: 240, padding: '0.6rem 0.8rem' };

  const rangeLabel = getRangeLabel(tooltipKey, value);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // Mobile: close on outside tap
  useEffect(() => {
    if (!isActive || !isMobile) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = wrapperRef.current?.contains(target);
      const inBubble = bubbleRef.current?.contains(target); // portaled — not inside wrapper
      if (!inTrigger && !inBubble) close(id);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isActive, isMobile, close, id]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(id);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isActive, close, id]);

  // Position the portaled bubble on show: render invisibly, measure both rects,
  // then place with viewport clamping (fixed coords, so no ancestor can clip it).
  useLayoutEffect(() => {
    if (!isActive) {
      setCoords(null);
      return;
    }
    if (!bubbleRef.current || !wrapperRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    // Measure the bubble with offsetWidth/Height, NOT getBoundingClientRect:
    // the entrance animation starts at scale 0.92 / translated, and a
    // transformed rect under-measures — every position was being computed
    // from a slightly-wrong size (visible as misaligned tooltips on desktop).
    // offset* report the untransformed layout box.
    const bubbleW = bubbleRef.current.offsetWidth;
    const bubbleH = bubbleRef.current.offsetHeight;
    const margin = 8;
    const gap = 10;

    const placement: 'above' | 'below' =
      wrapperRect.top - bubbleH - gap < margin ? 'below' : 'above';
    const top = placement === 'above' ? wrapperRect.top - bubbleH - gap : wrapperRect.bottom + gap;

    const triggerCenter = wrapperRect.left + wrapperRect.width / 2;
    let left = triggerCenter - bubbleW / 2;
    left = Math.min(Math.max(left, margin), window.innerWidth - bubbleW - margin);
    const arrowLeft = Math.min(Math.max(triggerCenter - left - 5, 10), bubbleW - 20);

    setCoords({ top, left, arrowLeft, placement });
  }, [isActive]);

  // Fixed positioning goes stale the moment anything scrolls — close instead
  // of chasing the trigger (capture-phase so inner scroll containers count).
  useEffect(() => {
    if (!isActive) return;
    const onScroll = () => close(id);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, [isActive, close, id]);

  const cancelTimers = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  const startShow = useCallback(() => {
    cancelTimers();
    showTimer.current = setTimeout(() => open(id), SHOW_DELAY);
  }, [cancelTimers, open, id]);

  const startHide = useCallback(() => {
    cancelTimers();
    hideTimer.current = setTimeout(() => close(id), HIDE_DELAY);
  }, [cancelTimers, close, id]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      if (isActive) {
        close(id);
      } else {
        open(id);
      }
    }
  }, [isMobile, isActive, open, close, id]);

  if (!entry) return <>{children}</>;

  const triggerStyle: CSSProperties = {
    borderBottom: variant === 'inline' ? '1px dotted rgba(17,17,17,0.3)' : undefined,
    cursor: 'help',
    position: 'relative' as const,
    ...(isMobile ? {
      minWidth: 44,
      minHeight: 44,
      display: 'inline-flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    } : {}),
  };

  const placement = coords?.placement ?? 'above';

  const bubbleStyle: CSSProperties = {
    position: 'fixed',
    top: coords?.top ?? 0,
    left: coords?.left ?? 0,
    visibility: coords ? 'visible' : 'hidden',
    width: 'max-content',
    maxWidth: sizes.maxWidth,
    backgroundColor: '#111111',
    color: '#ffffff',
    fontSize: sizes.body,
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: '0.02em',
    padding: sizes.padding,
    borderRadius: 0,
    zIndex: 1000,
    pointerEvents: 'auto' as const,
    textTransform: 'none' as const,
    transformOrigin: placement === 'above' ? 'bottom center' : 'top center',
  };

  const arrowStyle: CSSProperties = {
    position: 'absolute',
    ...(placement === 'above' ? { top: '100%' } : { bottom: '100%' }),
    left: coords?.arrowLeft ?? 12,
    width: 0,
    height: 0,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    ...(placement === 'above'
      ? { borderTop: '5px solid #111111' }
      : { borderBottom: '5px solid #111111' }),
  };

  return (
    <span
      ref={wrapperRef}
      style={{ position: 'relative', display: 'inline', ...style }}
      onMouseEnter={isMobile ? undefined : startShow}
      onMouseLeave={isMobile ? undefined : startHide}
    >
      <span
        style={triggerStyle}
        tabIndex={0}
        role="button"
        aria-describedby={isActive ? id : undefined}
        onClick={handleClick}
        onFocus={isMobile ? undefined : startShow}
        onBlur={isMobile ? undefined : startHide}
      >
        {children}
      </span>
      {createPortal(
      <AnimatePresence>
        {isActive && (
          <motion.span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={bubbleStyle}
            initial={{ opacity: 1, scale: 0.92, y: placement === 'above' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: placement === 'above' ? 4 : -4 }}
            transition={{
              opacity: { duration: 0.1 },
              scale: { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
              y: { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
            }}
            onMouseEnter={isMobile ? undefined : cancelTimers}
            onMouseLeave={isMobile ? undefined : startHide}
          >
            <span style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em', fontSize: sizes.title, color: 'rgba(255,255,255,0.75)' }}>
              {entry.title}
            </span>
            <PretextBlock entryId={`tooltip-body-${bodyVariant}`} style={{ display: 'block' }}>
              <span style={{ display: 'block' }}>
                {entry.description}
              </span>
              {rangeLabel && (
                <span style={{
                  display: 'block',
                  marginTop: '0.35rem',
                  paddingTop: '0.3rem',
                  borderTop: '1px solid rgba(255,255,255,0.15)',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}>
                  {rangeLabel}
                </span>
              )}
            </PretextBlock>
            <span style={arrowStyle} />
          </motion.span>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </span>
  );
}
