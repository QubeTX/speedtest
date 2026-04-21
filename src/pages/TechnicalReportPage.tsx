import { useState, useEffect } from 'react';
import TechnicalReportView from '../views/TechnicalReportView';
import AppStoreBadge from '../components/layout/AppStoreBadge';
import { useResponsive } from '../hooks/useResponsive';

export default function TechnicalReportPage() {
  const { isMobile } = useResponsive();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation after mount
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '0.5rem' : '1rem',
        overflow: 'auto',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      <TechnicalReportView />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0',
        flexShrink: 0,
      }}>
        <AppStoreBadge />
        <span style={{
          fontSize: '0.55rem',
          letterSpacing: '0.1em',
          color: 'rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}>
          &copy; 2026 QUBETX
        </span>
      </div>
    </div>
  );
}
