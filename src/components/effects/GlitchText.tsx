import { useEffect, useRef, type CSSProperties } from 'react';

interface GlitchTextProps {
  children: string;
  style?: CSSProperties;
}

export default function GlitchText({ children, style }: GlitchTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (ref.current) {
        const shift = (Math.random() - 0.5) * 2;
        ref.current.style.transform = `translateX(${shift}px)`;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <span ref={ref} style={{ display: 'inline-block', ...style }}>
      {children}
    </span>
  );
}
