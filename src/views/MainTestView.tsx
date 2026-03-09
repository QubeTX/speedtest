import { useState, useEffect } from 'react';
import { useSpeedTestContext } from '../store/SpeedTestContext';
import { useNavigate } from 'react-router-dom';
import Apparatus from '../components/layout/Apparatus';
import TopBar from '../components/layout/TopBar';
import SpeakerGrill from '../components/layout/SpeakerGrill';
import SysInfo from '../components/layout/SysInfo';
import TapeMechanism from '../components/mechanism/TapeMechanism';
import DataPanel from '../components/data/DataPanel';
import ResultsStamp from '../components/effects/ResultsStamp';
import ActionButton from '../components/ui/ActionButton';
import ConsentModal from '../components/ui/ConsentModal';
import { useResponsive } from '../hooks/useResponsive';

export default function MainTestView() {
  const {
    phase, progress, result, settings,
    startTest, resetTest, updateSettings,
  } = useSpeedTestContext();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  const needsConsent = (settings.providerMode === 'both' || settings.providerMode === 'ndt7') && !settings.dataPolicyAccepted;

  const isIdle = phase === 'idle';
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const isTesting = !isIdle && !isComplete && !isError;

  const handleMechanismPress = () => {
    if (isIdle) {
      startTest();
    } else if (isComplete || isError) {
      resetTest();
    }
  };

  // Status text
  let statusText = 'PRESS TO START';
  if (phase === 'discovering') statusText = 'CONNECTING';
  if (phase === 'latency') statusText = 'MEASURING LATENCY';
  if (phase === 'download') statusText = 'TESTING DOWNLOAD';
  if (phase === 'upload') statusText = 'TESTING UPLOAD';
  if (isComplete) statusText = 'SYSTEM STANDBY';
  if (isError) statusText = 'CONNECTION FAILURE';

  // Provider label shown separately during active test phases
  const isTransitioning = progress.currentProvider?.toLowerCase().startsWith('switching');
  const providerLabel = isTesting && progress.currentProvider
    ? (isTransitioning ? progress.currentProvider.toUpperCase() : `VIA ${progress.currentProvider.toUpperCase()}`)
    : null;

  // Provider-switch overlay: show briefly when transitioning
  const [showSwitchOverlay, setShowSwitchOverlay] = useState(false);
  useEffect(() => {
    if (isTransitioning) {
      setShowSwitchOverlay(true);
      const timer = setTimeout(() => setShowSwitchOverlay(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  // Current speed for reel animation
  const currentSpeed = phase === 'download'
    ? (progress.downloadSpeed ?? 0)
    : phase === 'upload'
      ? (progress.uploadSpeed ?? 0)
      : 0;

  const leftPanel = (
    <>
      <TopBar
        label={isError ? 'SYS.TEST.01 // ERROR' : undefined}
        errorTag={isError ? '0x000F4' : undefined}
      />

      <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <div
          style={{
            fontSize: isMobile ? '1rem' : '1.25rem',
            fontWeight: isError ? 700 : 500,
            height: '1.5em',
            letterSpacing: '0.05em',
            color: isError ? '#ff3b30' : '#111111',
          }}
        >
          {statusText}
        </div>
        {providerLabel && (
          <div
            key={providerLabel}
            style={{
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
              opacity: 0.55,
              marginTop: '0.2rem',
              animation: 'fade-in 0.4s ease',
            }}
          >
            {providerLabel}
          </div>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <ResultsStamp visible={isComplete} />
        <TapeMechanism
          phase={phase}
          currentSpeed={currentSpeed}
          onPress={handleMechanismPress}
          disabled={isTesting}
        />
        {showSwitchOverlay && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: '16px',
              padding: '1.25rem 1.75rem',
              textAlign: 'center',
              zIndex: 10,
              animation: 'fade-in 0.3s ease',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', opacity: 0.5, marginBottom: '0.5rem' }}>
              CLOUDFLARE COMPLETE
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em' }}>
              SWITCHING TO M-LAB
            </div>
            <div style={{
              width: '40px',
              height: '3px',
              backgroundColor: '#111',
              borderRadius: '2px',
              margin: '0.6rem auto 0',
              animation: 'pulse-scale 1s ease infinite',
            }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        {isComplete && (
          <ActionButton onClick={() => { resetTest(); startTest(); }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor">
              <path d="m15.99 0.44c-8.51 0-15.51 6.93-15.51 15.56h3.49c0-6.71 5.61-12.01 12-12.01 6.78 0 12.04 5.53 12.04 12.02 0 6.72-5.49 11.98-12.13 11.98-3 0-5.51-1.05-7.45-2.72l3.15-2.05-9.4-4.12 0.01 10.21 3.18-2.07c2.87 2.7 6.31 4.32 10.51 4.32 8.63 0 15.69-7.07 15.69-15.55 0-8.5-7.06-15.57-15.58-15.57z" />
            </svg>
            RUN AGAIN
          </ActionButton>
        )}

        {isError && (
          <ActionButton onClick={() => { resetTest(); startTest(); }}>
            RETRY
          </ActionButton>
        )}
      </div>

      <div style={{ marginTop: 'auto', width: '100%' }}>
        <SpeakerGrill height={isMobile ? 48 : 72} />
        <SysInfo
          serverName={progress.serverName}
          isp={result?.isp}
          isError={isError}
          errorDetails={isError ? [
            'GATEWAY: UNREACHABLE',
            progress.error || 'UNKNOWN_ERROR',
          ] : undefined}
        />
      </div>

      {/* Settings gear icon - positioned bottom right */}
      <button
        onClick={() => navigate('/settings')}
        style={{
          position: 'absolute',
          bottom: isMobile ? '1rem' : '1.5rem',
          right: isMobile ? '1.5rem' : '2rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          opacity: 0.4,
          transition: 'opacity 0.2s',
          padding: '4px',
          display: isIdle || isComplete ? 'block' : 'none',
          zIndex: 20,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; }}
      >
        <svg width="18" height="18" viewBox="0 0 256 256" fill="#111">
          <path d="m252.2 144.9v-34.06l-34.54-5.92c-2.4-9.02-5.47-16.34-9.65-23.4l20.65-29.11-25.92-24.92-28.23 20.72c-7.94-4.72-15.52-8.05-24.27-10.18l-4.98-33.71h-34.5l-5.37 33.66c-9.65 2.54-15.16 5.1-24.1 10.06l-28.93-20.55-25.21 24.65 20.49 28.99c-4.88 8.07-7.48 14.29-10.08 23.85l-33.11 5.86v34.29l32.89 5.5c2.13 8.4 5.02 15.48 10.16 23.95l-20.35 28.4 25.51 25.15 28.55-20.37c7.96 4.84 14.57 7.3 23.87 9.51l5.48 34.05h34.7l5.11-34.12c9.01-2.51 16.41-5.49 23.77-10l28.42 20.93 25.87-25.15-20.66-28.28c4.65-8.02 7.55-14.61 9.72-24.02l34.71-5.78zm-124.8 34.42c-29.67 0-51.11-24.58-51.11-51.19 0-28.27 23.34-51.85 51.14-51.85 28.63 0 51.88 23.19 51.88 51.9 0 27.03-22.39 51.14-51.91 51.14z" />
        </svg>
      </button>
    </>
  );

  const rightPanel = (
    <DataPanel
      phase={phase}
      progress={progress}
      result={result}
      speedUnit={settings.speedUnit}
    />
  );

  return (
    <>
      {needsConsent && (
        <ConsentModal
          onAccept={() => updateSettings({ dataPolicyAccepted: true })}
          onDecline={() => updateSettings({ providerMode: 'cloudflare' })}
        />
      )}
      <Apparatus left={leftPanel} right={rightPanel} />
    </>
  );
}
