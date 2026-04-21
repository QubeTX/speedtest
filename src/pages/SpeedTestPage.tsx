import MainTestView from '../views/MainTestView';
import AppStoreBadge from '../components/layout/AppStoreBadge';
import { useResponsive } from '../hooks/useResponsive';

export default function SpeedTestPage() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? '0.5rem' : '1rem',
        overflow: 'auto',
      }}
    >
      <MainTestView />
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
