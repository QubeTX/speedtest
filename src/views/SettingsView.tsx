import { useNavigate } from 'react-router-dom';
import { useSpeedTestContext } from '../store/SpeedTestContext';
import { useNetworkInfo } from '../hooks/useNetworkInfo';
import { useResponsive } from '../hooks/useResponsive';
import Apparatus from '../components/layout/Apparatus';
import TopBar from '../components/layout/TopBar';
import SpeakerGrill from '../components/layout/SpeakerGrill';
import CrosshairCorners from '../components/layout/CrosshairCorners';
import type { ProviderMode, TestDuration, SpeedUnit } from '../types/speedtest';
import type { CSSProperties } from 'react';

const PROVIDER_OPTIONS: { mode: ProviderMode; label: string; desc: string }[] = [
  { mode: 'both', label: 'BOTH (AGGREGATED)', desc: 'Cloudflare + M-Lab averaged' },
  { mode: 'cloudflare', label: 'CLOUDFLARE', desc: 'Latency, Jitter, Packet Loss, DL, UL' },
  { mode: 'ndt7', label: 'M-LAB NDT7', desc: 'Google-backed • Latency, DL, UL' },
];

const DURATION_OPTIONS: { value: TestDuration; label: string }[] = [
  { value: 'auto', label: 'AUTO' },
  { value: 15, label: '15 SEC' },
  { value: 30, label: '30 SEC' },
  { value: 60, label: '1 MIN' },
  { value: 120, label: '2 MIN' },
  { value: 300, label: '5 MIN' },
  { value: 600, label: '10 MIN' },
];

const UNIT_OPTIONS: { value: SpeedUnit; label: string }[] = [
  { value: 'auto', label: 'AUTO' },
  { value: 'Mbps', label: 'MBPS' },
  { value: 'Kbps', label: 'KBPS' },
  { value: 'Gbps', label: 'GBPS' },
];

export default function SettingsView() {
  const { settings, updateSettings, history, clearHistory } = useSpeedTestContext();
  const navigate = useNavigate();
  const network = useNetworkInfo();
  const { isMobile } = useResponsive();

  const rowStyle = (active: boolean): CSSProperties => ({
    padding: isMobile ? '1rem 1.5rem' : '1.25rem 3rem',
    borderBottom: '3px solid #111',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    backgroundColor: active ? '#ffffff' : 'transparent',
    position: 'relative',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  });

  const sectionLabel: CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    padding: isMobile ? '0.75rem 1.5rem 0.25rem' : '0.75rem 3rem 0.25rem',
    opacity: 0.4,
    borderBottom: '1px solid rgba(17,17,17,0.1)',
  };

  const needsConsent = settings.providerMode === 'ndt7' || settings.providerMode === 'both';

  const leftPanel = (
    <>
      <TopBar label="SYS.CFG" />

      <div style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '2rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        SETTINGS
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          bottom: isMobile ? '1rem' : '1.5rem',
          left: isMobile ? '1.5rem' : '2rem',
          padding: '0.75rem 1.5rem',
          border: '3px solid #111',
          background: 'transparent',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          transition: 'background-color 0.2s, color 0.2s',
          zIndex: 20,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#111'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#111'; }}
      >
        ← BACK
      </button>

      <SpeakerGrill height={isMobile ? 40 : 80} />
    </>
  );

  const rightPanel = (
    <div style={{ overflowY: 'auto', maxHeight: isMobile ? '400px' : '100%' }}>
      {/* Provider Selection */}
      <div style={sectionLabel}>PROVIDER</div>
      {PROVIDER_OPTIONS.map(opt => (
        <div
          key={opt.mode}
          style={rowStyle(settings.providerMode === opt.mode)}
          onClick={() => updateSettings({ providerMode: opt.mode })}
        >
          <CrosshairCorners />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{opt.label}</div>
            <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '0.25rem', letterSpacing: '0.05em' }}>{opt.desc}</div>
          </div>
          {settings.providerMode === opt.mode && (
            <span style={{ fontSize: '1.2rem' }}>●</span>
          )}
        </div>
      ))}

      {/* M-Lab Consent */}
      {needsConsent && (
        <>
          <div style={sectionLabel}>DATA POLICY</div>
          <div
            style={{
              ...rowStyle(false),
              cursor: 'pointer',
              gap: '1rem',
            }}
            onClick={() => updateSettings({ dataPolicyAccepted: !settings.dataPolicyAccepted })}
          >
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #111',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              backgroundColor: settings.dataPolicyAccepted ? '#111' : 'transparent',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              {settings.dataPolicyAccepted ? '✓' : ''}
            </div>
            <div style={{ fontSize: '0.65rem', lineHeight: 1.5, opacity: 0.7, flex: 1 }}>
              I accept M-Lab's data collection policy. Test data including IP address is collected and published as open data.
            </div>
          </div>
        </>
      )}

      {/* Duration */}
      <div style={sectionLabel}>TEST DURATION</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '3px solid #111' }}>
        {DURATION_OPTIONS.map(opt => (
          <div
            key={String(opt.value)}
            onClick={() => updateSettings({ testDuration: opt.value })}
            style={{
              flex: '1 0 auto',
              minWidth: isMobile ? '25%' : '14%',
              padding: '0.75rem',
              textAlign: 'center',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              backgroundColor: settings.testDuration === opt.value ? '#111' : 'transparent',
              color: settings.testDuration === opt.value ? '#fff' : '#111',
              transition: 'all 0.15s',
              borderRight: '1px solid rgba(17,17,17,0.1)',
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>

      {/* Speed Units */}
      <div style={sectionLabel}>DISPLAY UNITS</div>
      <div style={{ display: 'flex', borderBottom: '3px solid #111' }}>
        {UNIT_OPTIONS.map(opt => (
          <div
            key={opt.value}
            onClick={() => updateSettings({ speedUnit: opt.value })}
            style={{
              flex: 1,
              padding: '0.75rem',
              textAlign: 'center',
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              backgroundColor: settings.speedUnit === opt.value ? '#111' : 'transparent',
              color: settings.speedUnit === opt.value ? '#fff' : '#111',
              transition: 'all 0.15s',
              borderRight: '1px solid rgba(17,17,17,0.1)',
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div style={sectionLabel}>OPTIONS</div>
      <div
        style={rowStyle(false)}
        onClick={() => updateSettings({ autoCopyResults: !settings.autoCopyResults })}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>AUTO-COPY RESULTS</span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.25rem 0.75rem',
          border: '2px solid #111',
          borderRadius: '999px',
          backgroundColor: settings.autoCopyResults ? '#111' : 'transparent',
          color: settings.autoCopyResults ? '#fff' : '#111',
          transition: 'all 0.15s',
        }}>
          {settings.autoCopyResults ? 'ON' : 'OFF'}
        </span>
      </div>
      <div
        style={rowStyle(false)}
        onClick={() => updateSettings({ soundEffects: !settings.soundEffects })}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>SOUND EFFECTS</span>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '0.25rem 0.75rem',
          border: '2px solid #111',
          borderRadius: '999px',
          backgroundColor: settings.soundEffects ? '#111' : 'transparent',
          color: settings.soundEffects ? '#fff' : '#111',
          transition: 'all 0.15s',
        }}>
          {settings.soundEffects ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Network Info */}
      {network.available && (
        <>
          <div style={sectionLabel}>NETWORK</div>
          <div style={{ ...rowStyle(false), flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', cursor: 'default' }}>
            {network.type && (
              <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                TYPE: {network.type.toUpperCase()}
              </div>
            )}
            {network.effectiveType && (
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                EFFECTIVE: {network.effectiveType.toUpperCase()}
              </div>
            )}
            {network.downlink !== null && (
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                EST. BANDWIDTH: {network.downlink} Mbps
              </div>
            )}
            {network.rtt !== null && (
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                EST. RTT: {network.rtt} ms
              </div>
            )}
          </div>
        </>
      )}

      {/* History */}
      <div style={sectionLabel}>HISTORY ({history.length})</div>
      {history.length > 0 ? (
        <>
          {history.slice(0, 10).map((h, i) => (
            <div key={i} style={{ ...rowStyle(false), cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
              <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>
                {new Date(h.timestamp).toLocaleString()} • {h.provider.toUpperCase()}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                ↓ {h.downloadSpeed.toFixed(0)} Mbps &nbsp; ↑ {h.uploadSpeed.toFixed(0)} Mbps &nbsp; {h.ping.toFixed(0)} ms
              </div>
            </div>
          ))}
          <div
            style={{ ...rowStyle(false), justifyContent: 'center', cursor: 'pointer' }}
            onClick={clearHistory}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ff3b30', letterSpacing: '0.1em' }}>CLEAR HISTORY</span>
          </div>
        </>
      ) : (
        <div style={{ ...rowStyle(false), cursor: 'default', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>NO TESTS YET</span>
        </div>
      )}
    </div>
  );

  return <Apparatus left={leftPanel} right={rightPanel} />;
}
