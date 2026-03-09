import MainTestView from '../views/MainTestView';
import { useResponsive } from '../hooks/useResponsive';

export default function SpeedTestPage() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? '0.5rem' : '1rem',
        overflow: isMobile ? 'auto' : 'hidden',
      }}
    >
      <MainTestView />
      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.1em',
        color: 'rgba(0,0,0,0.2)',
        textAlign: 'center',
        padding: '0.5rem 0',
        flexShrink: 0,
      }}>
        &copy; 2026 QUBETX
      </div>
    </div>
  );
}
