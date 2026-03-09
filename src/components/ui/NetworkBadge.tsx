import { useNetworkInfo } from '../../hooks/useNetworkInfo';
import type { CSSProperties } from 'react';

export default function NetworkBadge() {
  const { type, effectiveType, available } = useNetworkInfo();

  if (!available) return null;

  const parts: string[] = [];
  if (type) parts.push(type.toUpperCase());
  if (effectiveType) parts.push(effectiveType.toUpperCase());

  if (parts.length === 0) return null;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.6rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.5rem',
    border: '1.5px solid #111',
    borderRadius: '4px',
    opacity: 0.6,
  };

  return <span style={style}>{parts.join(' • ')}</span>;
}
