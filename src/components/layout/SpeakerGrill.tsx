import type { CSSProperties } from 'react';

export default function SpeakerGrill({ height = 80 }: { height?: number }) {
  const style: CSSProperties = {
    width: '100%',
    height: `${height}px`,
    backgroundImage: 'radial-gradient(circle, #111111 2.5px, transparent 3px)',
    backgroundSize: '16px 16px',
    backgroundPosition: 'center',
    opacity: 0.9,
    pointerEvents: 'none',
    flexShrink: 1,
    minHeight: '32px',
  };
  return <div style={style} />;
}
