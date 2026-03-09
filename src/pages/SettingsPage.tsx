import SettingsView from '../views/SettingsView';
import { useResponsive } from '../hooks/useResponsive';

export default function SettingsPage() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0.5rem' : '1rem',
      }}
    >
      <SettingsView />
    </div>
  );
}
