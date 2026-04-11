import { useState, useRef, useEffect, useLayoutEffect, useId, useCallback, createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { tooltips, getRangeLabel } from '../../content/tooltips';
import { useResponsive } from '../../hooks/useResponsive';
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

  const [position, setPosition] = useState<'above' | 'below'>('above');
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const { isMobile, breakpoint } = useResponsive();

  const tooltipSizes = {
    mobile:       { body: '0.65rem', title: '0.6rem',  maxWidth: 240, padding: '0.6rem 0.8rem' },
    tablet:       { body: '0.7rem',  title: '0.65rem', maxWidth: 280, padding: '0.65rem 0.85rem' },
    smallDesktop: { body: '0.75rem', title: '0.7rem',  maxWidth: 310, padding: '0.7rem 0.9rem' },
    desktop:      { body: '0.8rem',  title: '0.75rem', maxWidth: 340, padding: '0.75rem 1rem' },
  } as const;
  const sizes = tooltipSizes[breakpoint];

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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close(id);
      }
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

  // Reposition bubble on show
  useLayoutEffect(() => {
    if (!isActive || !bubbleRef.current || !wrapperRef.current) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();

    // Vertical: flip below if not enough room above
    if (wrapperRect.top - bubbleRect.height - 12 < 8) {
      setPosition('below');
    } else {
      setPosition('above');
    }

    // Horizontal: shift right-aligned if overflowing right edge
    if (wrapperRect.left + bubbleRect.width > window.innerWidth - 12) {
      setAlign('right');
    } else {
      setAlign('left');
    }
  }, [isActive]);

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

  const bubbleStyle: CSSProperties = {
    position: 'absolute',
    ...(position === 'above'
      ? { bottom: 'calc(100% + 10px)' }
      : { top: 'calc(100% + 10px)' }),
    ...(align === 'left' ? { left: 0 } : { right: 0 }),
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
    zIndex: 30,
    pointerEvents: 'auto' as const,
    textTransform: 'none' as const,
    transformOrigin: position === 'above' ? 'bottom center' : 'top center',
  };

  const arrowStyle: CSSProperties = {
    position: 'absolute',
    ...(position === 'above'
      ? { top: '100%' }
      : { bottom: '100%' }),
    ...(align === 'left' ? { left: 12 } : { right: 12 }),
    width: 0,
    height: 0,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    ...(position === 'above'
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
      <AnimatePresence>
        {isActive && (
          <motion.span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={bubbleStyle}
            initial={{ opacity: 1, scale: 0.92, y: position === 'above' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'above' ? 4 : -4 }}
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
            <PretextBlock entryId={`tooltip-body-${breakpoint}`} style={{ display: 'block' }}>
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
      </AnimatePresence>
    </span>
  );
}
