import { colors } from '../../theme/tokens';
import type { CSSProperties } from 'react';

export default function CrosshairCorners() {
  const base: CSSProperties = {
    position: 'absolute',
    width: '10px',
    height: '10px',
  };
  return (
    <>
      <div
        style={{
          ...base,
          top: '10px',
          left: '10px',
          borderTop: `2px solid ${colors.ink}`,
          borderLeft: `2px solid ${colors.ink}`,
        }}
      />
      <div
        style={{
          ...base,
          bottom: '10px',
          right: '10px',
          borderBottom: `2px solid ${colors.ink}`,
          borderRight: `2px solid ${colors.ink}`,
        }}
      />
    </>
  );
}
