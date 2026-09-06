// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { useReelDrive } from '../../hooks/useReelDrive';
import TapeReel from './TapeReel';
import { CASSETTE_SHELL } from './cassette-shell';
import { fontFamilies } from '../../theme/tokens';
import type { TestPhase } from '../../types/speedtest';

interface Props { phase: TestPhase; currentSpeed?: number; downloadProgress?: number; uploadProgress?: number; onPress: () => void; disabled?: boolean; resetting?: boolean }
export default function TapeMechanism({ phase, currentSpeed = 0, downloadProgress = 0, uploadProgress = 0, onPress, disabled, resetting = false }: Props) {
  const active = phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  const drive = useReelDrive({ phase, mbps: currentSpeed, dlProgress: downloadProgress / 100, ulProgress: uploadProgress / 100 });
  const label = resetting ? 'REWIND' : active ? 'STOP' : phase === 'complete' ? 'NEW TEST' : phase === 'error' ? 'RETRY' : 'START';
  return <button className="cassette-transport" onClick={onPress} disabled={disabled} aria-disabled={resetting || undefined} aria-label={resetting ? 'Resetting speed test' : `${label.toLowerCase()} speed test`}
    style={{ display: 'block', width: '100%', maxWidth: 470, aspectRatio: '360 / 212', position: 'relative', border: 0, background: 'transparent', padding: 0, color: '#111', cursor: disabled ? 'default' : 'pointer', touchAction: 'manipulation' }}>
    <style>{`.cassette-transport:active:not(:disabled){transform:translateY(2px)}.cassette-transport:focus-visible{outline:3px solid #111;outline-offset:5px;border-radius:18px}.cassette-reel svg{width:100%;height:100%}@keyframes probe-pulse{from{opacity:1}to{opacity:.2}}.cassette-probing{animation:probe-pulse .6s ease-in-out infinite alternate}@media(prefers-reduced-motion:reduce){.cassette-probing{animation:none}}`}</style>
    <span className="cassette-housing" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: CASSETTE_SHELL }} />
    <span aria-hidden="true" style={{ position: 'absolute', left: '10%', top: '12%', color: '#536176', fontFamily: fontFamilies.instrument, fontSize: 'clamp(9px, 2.7vw, 13px)', letterSpacing: '.06em', fontWeight: 600 }}>SPEEDQX / QX–05</span>
    <span aria-hidden="true" style={{ position: 'absolute', right: '10%', top: '12%', color: '#536176', fontFamily: fontFamilies.instrument, fontSize: 'clamp(9px, 2.7vw, 13px)' }}>{phase === 'upload' ? 'B ← SEND' : 'A → RECEIVE'}</span>
    <span className="cassette-reel" aria-hidden="true" style={{ position: 'absolute', left: '15.278%', top: '28.302%', width: '25%', aspectRatio: '1' }}><span className="cassette-rewind-rotor"><TapeReel ref={drive.supplyRef} size={90} tapeFill={drive.supplyFill} reduced={drive.reduced} /></span></span>
    <span className="cassette-reel" aria-hidden="true" style={{ position: 'absolute', left: '59.722%', top: '28.302%', width: '25%', aspectRatio: '1' }}><span className="cassette-rewind-rotor"><TapeReel ref={drive.takeupRef} size={90} tapeFill={drive.takeupFill} reduced={drive.reduced} /></span></span>
    <span aria-hidden="true" style={{ position: 'absolute', top: '79.5%', left: '36%', width: '28%', color: '#fff', fontFamily: fontFamilies.instrument, fontSize: 'clamp(10px, 2.8vw, 13px)', fontWeight: 600, letterSpacing: '.06em' }}>{resetting ? '«' : active ? '■' : '▶'} {label}</span>
    <span aria-hidden="true" className={phase === 'latency' || phase === 'discovering' ? 'cassette-probing' : undefined} style={{ position: 'absolute', left: '48.7%', top: '47%', width: '2.6%', aspectRatio: '1', border: '1px solid #7e8da1', borderRadius: '50%', background: phase === 'latency' || phase === 'discovering' || active && currentSpeed > 0 ? '#3c4654' : '#aebed0' }} />
    {(phase === 'latency' || phase === 'discovering') && <span aria-hidden="true" style={{ position: 'absolute', left: '32.8%', width: '34.4%', top: '59.4%', fontFamily: fontFamilies.instrument, fontSize: 'clamp(7px, 2vw, 10px)' }}>{phase === 'latency' ? 'MEASURING PING' : 'CONNECTING'}</span>}
  </button>;
}
