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
    style={{ display: 'block', width: '100%', maxWidth: 470, aspectRatio: '360 / 200', position: 'relative', border: 0, background: 'transparent', padding: 0, color: '#111', cursor: disabled ? 'default' : 'pointer', touchAction: 'manipulation' }}>
    <style>{`.cassette-transport:active:not(:disabled){transform:translateY(2px)}.cassette-transport:focus-visible{outline:3px solid #111;outline-offset:5px;border-radius:18px}.cassette-reel svg{width:100%;height:100%}@keyframes probe-pulse{from{opacity:1}to{opacity:.2}}.cassette-probing{animation:probe-pulse .6s ease-in-out infinite alternate}@media(prefers-reduced-motion:reduce){.cassette-probing{animation:none}}`}</style>
    <span className="cassette-housing" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} dangerouslySetInnerHTML={{ __html: CASSETTE_SHELL }} />
    <span className="cassette-reel" aria-hidden="true" style={{ position: 'absolute', left: '9.722%', top: '12.5%', width: '27.778%', aspectRatio: '1' }}><span className="cassette-rewind-rotor"><TapeReel ref={drive.supplyRef} size={100} tapeFill={drive.supplyFill} reduced={drive.reduced} /></span></span>
    <span className="cassette-reel" aria-hidden="true" style={{ position: 'absolute', left: '62.5%', top: '12.5%', width: '27.778%', aspectRatio: '1' }}><span className="cassette-rewind-rotor"><TapeReel ref={drive.takeupRef} size={100} tapeFill={drive.takeupFill} reduced={drive.reduced} /></span></span>
    <span aria-hidden="true" style={{ position: 'absolute', top: '73.5%', height: '17%', left: '23.889%', width: '52.222%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#fff', fontFamily: fontFamilies.display, fontSize: 'clamp(11px, 2.8vw, 14px)', fontWeight: 600, letterSpacing: '.02em' }}><span>{resetting ? '«' : active ? '■' : '▶'}</span>{label}</span>
    <span aria-hidden="true" className={phase === 'latency' || phase === 'discovering' ? 'cassette-probing' : undefined} style={{ position: 'absolute', left: '48.7%', top: '35.16%', width: '2.6%', aspectRatio: '1', border: '1px solid #7e8da1', borderRadius: '50%', background: phase === 'latency' || phase === 'discovering' || active && currentSpeed > 0 ? '#3c4654' : '#b6c3d3' }} />
  </button>;
}
