import MainTestView from '../views/MainTestView';
import { useResponsive } from '../hooks/useResponsive';

export default function SpeedTestPage() {
  const { isMobile } = useResponsive();

  return (
    <div
      style={{
        height: '100svh',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0.5rem' : '1rem',
        overflow: isMobile ? 'auto' : 'hidden',
      }}
    >
      <MainTestView />
    </div>
  );
}
