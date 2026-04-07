import { useState, useRef, useEffect, useLayoutEffect, useId, useCallback, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { tooltips, getRangeLabel } from '../../content/tooltips';
import { useResponsive } from '../../hooks/useResponsive';

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
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const { isMobile } = useResponsive();

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
    if (!visible || !isMobile) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [visible, isMobile]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible]);

  // Reposition bubble on show
  useLayoutEffect(() => {
    if (!visible || !bubbleRef.current || !wrapperRef.current) return;

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
  }, [visible]);

  const cancelTimers = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);

  const startShow = useCallback(() => {
    cancelTimers();
    showTimer.current = setTimeout(() => setVisible(true), SHOW_DELAY);
  }, [cancelTimers]);

  const startHide = useCallback(() => {
    cancelTimers();
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY);
  }, [cancelTimers]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      setVisible(v => !v);
    }
  }, [isMobile]);

  if (!entry) return <>{children}</>;

  const triggerStyle: CSSProperties = {
    borderBottom: variant === 'inline' ? '1px dotted rgba(17,17,17,0.3)' : undefined,
    cursor: 'help',
    position: 'relative' as const,
  };

  const bubbleStyle: CSSProperties = {
    position: 'absolute',
    ...(position === 'above'
      ? { bottom: 'calc(100% + 10px)' }
      : { top: 'calc(100% + 10px)' }),
    ...(align === 'left' ? { left: 0 } : { right: 0 }),
    width: 'max-content',
    maxWidth: isMobile ? 240 : 280,
    backgroundColor: 'rgba(17, 17, 17, 0.97)',
    color: '#ffffff',
    fontSize: '0.65rem',
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: '0.02em',
    padding: '0.6rem 0.8rem',
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
      ? { borderTop: '5px solid rgba(17, 17, 17, 0.97)' }
      : { borderBottom: '5px solid rgba(17, 17, 17, 0.97)' }),
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
        aria-describedby={visible ? id : undefined}
        onClick={handleClick}
        onFocus={isMobile ? undefined : startShow}
        onBlur={isMobile ? undefined : startHide}
      >
        {children}
      </span>
      <AnimatePresence>
        {visible && (
          <motion.span
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={bubbleStyle}
            initial={{ opacity: 0, scale: 0.92, y: position === 'above' ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: position === 'above' ? 4 : -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            onMouseEnter={isMobile ? undefined : cancelTimers}
            onMouseLeave={isMobile ? undefined : startHide}
          >
            <span style={{ fontWeight: 700, display: 'block', marginBottom: '0.25rem', letterSpacing: '0.05em', fontSize: '0.6rem', opacity: 0.6 }}>
              {entry.title}
            </span>
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
            <span style={arrowStyle} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
