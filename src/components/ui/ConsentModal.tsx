import type { CSSProperties } from 'react';
import { colors, borders, typography } from '../../theme/tokens';

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  };

  const card: CSSProperties = {
    backgroundColor: colors.bgDevice,
    border: borders.stroke,
    borderRadius: borders.radiusBox,
    maxWidth: '420px',
    width: '100%',
    padding: '2rem',
    fontFamily: typography.fontFamily,
  };

  const heading: CSSProperties = {
    ...typography.metaLabel,
    fontSize: '0.85rem',
    marginBottom: '1.25rem',
  };

  const body: CSSProperties = {
    fontSize: '0.8rem',
    lineHeight: 1.7,
    color: colors.ink,
    opacity: 0.75,
    marginBottom: '1.5rem',
  };

  const btnBase: CSSProperties = {
    fontFamily: typography.fontFamily,
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    border: borders.stroke,
    borderRadius: borders.radiusPill,
    padding: '0.65rem 1.5rem',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  };

  const acceptBtn: CSSProperties = {
    ...btnBase,
    backgroundColor: colors.ink,
    color: colors.paper,
  };

  const declineBtn: CSSProperties = {
    ...btnBase,
    backgroundColor: 'transparent',
    color: colors.ink,
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={heading}>M-LAB DATA POLICY</div>
        <div style={body}>
          This app uses <strong>M-Lab</strong> (Measurement Lab) to measure your connection speed.
          M-Lab collects and publishes your <strong>IP address</strong> and test results as open data
          for internet research. By accepting, you consent to this data collection.
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={acceptBtn} onClick={onAccept}>ACCEPT</button>
          <button style={declineBtn} onClick={onDecline}>DECLINE</button>
        </div>
      </div>
    </div>
  );
}
