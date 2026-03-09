import SettingsView from '../views/SettingsView';
import { useResponsive } from '../hooks/useResponsive';

export default function SettingsPage() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? '0.5rem' : '1rem',
      }}
    >
      <SettingsView />
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
