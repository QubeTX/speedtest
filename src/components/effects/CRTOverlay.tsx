import type { CSSProperties } from 'react';

export default function CRTOverlay() {
  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      'linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.05) 50%), linear-gradient(90deg, rgba(255,0,0,0.02), rgba(0,255,0,0.01), rgba(0,0,255,0.02))',
    backgroundSize: '100% 4px, 3px 100%',
    pointerEvents: 'none',
    zIndex: 5,
  };
  return <div style={style} />;
}
