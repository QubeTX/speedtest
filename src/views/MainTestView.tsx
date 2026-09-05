// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpeedTestContext } from '../store/SpeedTestContext';
import TapeMechanism from '../components/mechanism/TapeMechanism';
import V5Details from '../components/data/V5Details';
import { formatSpeed } from '../types/speedtest';
import { PROFILES } from '../services/measurement-v5';
import './instrument-v5.css';

export default function MainTestView() {
  const { phase, progress, result, settings, updateSettings, startTest, stopTest, resetTest } = useSpeedTestContext();
  const [details, setDetails] = useState(false);
  const [metricInfo, setMetricInfo] = useState<string | null>(null);
  const explanation = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (metricInfo) explanation.current?.showModal(); }, [metricInfo]);
  const profile = settings.testProfile ?? 'fast', policy = PROFILES[profile];
  const complete = phase === 'complete', active = !['idle', 'complete', 'error'].includes(phase);
  const measurement = result?.measurement;
  const dl = complete && result ? measurement ? measurement.download.sustainedMbps : result.downloadSpeed : progress.downloadSpeed;
  const ul = complete && result ? measurement ? measurement.upload.sustainedMbps : result.uploadSpeed : progress.uploadSpeed;
  const ping = complete && result ? result.httpLatency && !result.httpLatency.idle.length ? null : result.ping : progress.ping;
  const jitter = complete && result ? result.httpLatency && !result.httpLatency.idle.length ? null : result.jitter : progress.jitter;
  const status = { idle: 'Ready to measure', discovering: 'Connecting', latency: 'Idle latency', download: 'Receiving', upload: 'Sending', complete: measurement?.stopReason === 'cancelled' ? 'Stopped · partial result' : measurement?.stopReason === 'complete' ? 'Measurement complete' : 'Partial measurement', error: 'Measurement unavailable' }[phase];
  const speed = phase === 'download' ? progress.downloadSpeed ?? 0 : phase === 'upload' ? progress.uploadSpeed ?? 0 : 0;
  const action = () => { setDetails(false); if (active) stopTest(); else if (complete) resetTest(); else void startTest(profile); };
  const cells = [{ label: 'DOWNLOAD', value: dl, ceiling: measurement?.download.ceilingMbps }, { label: 'UPLOAD', value: ul, ceiling: measurement?.upload.ceilingMbps }];
  return <main className="v5-instrument">
    <header className="v5-top"><span className="v5-brand">SpeedQX</span><nav aria-label="Instrument navigation"><Link to="/how-it-works">Method</Link><Link to="/settings">Settings</Link></nav></header>
    <div className="v5-body">
      <section className="v5-deck" aria-label="Test transport">
        <div className="v5-status" role="status"><strong>{status}</strong><span>{active ? progress.currentProvider : profile === 'fast' ? 'Quick / 90 s max' : 'Deep / 5 min max'}</span></div>
        <TapeMechanism phase={phase} currentSpeed={speed} downloadProgress={progress.downloadProgress} uploadProgress={progress.uploadProgress} onPress={action} />
        <div className="v5-modes" role="radiogroup" aria-label="Measurement profile">{(['fast', 'full'] as const).map(mode => <button key={mode} role="radio" aria-checked={profile === mode} disabled={active} onClick={() => updateSettings({ testProfile: mode })}>{mode === 'fast' ? 'QUICK' : 'DEEP'}<small>{mode === 'fast' ? '90 SEC MAX' : '5 MIN MAX'}</small></button>)}</div>
        <p className="v5-data-note">{measurement && complete ? `${(measurement.bytesTransferred / 1e6).toFixed(1)} MB confirmed · ${(measurement.elapsedMs / 1000).toFixed(1)} seconds` : active && progress.runData ? `${(progress.runData.confirmedBytes / 1e6).toFixed(1)} MB confirmed · ${(progress.runData.elapsedMs / 1000).toFixed(1)} seconds · ${(progress.runData.budgetBytes / 1e6).toFixed(0)} / ${(progress.runData.byteLimit / 1e6).toFixed(0)} MB budget` : `Estimated data use: up to ${((settings.maxBytes ?? policy.defaultMaxBytes) / 1e9).toFixed(2)} GB + protocol overhead`}</p>
        {!active && !complete && <label className="v5-data-note" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textAlign: 'left' }}><input type="checkbox" checked={settings.dataPolicyAccepted} onChange={event => updateSettings({ dataPolicyAccepted: event.target.checked })} /><span>Allow M-Lab to publish my IP address and results. <a href="https://www.measurementlab.net/tests/ndt/" target="_blank" rel="noreferrer">Data policy</a></span></label>}
      </section>
      <section className="v5-readout" aria-label="Measurement results">
        <p className="v5-result-label"><strong>{complete ? 'SUSTAINED THROUGHPUT' : active ? 'LIVE MEASUREMENT' : 'YOUR CONNECTION, MEASURED'}</strong>{complete ? <><br />Usable speed on this device and these paths.</> : null}</p>
        <div className="v5-metrics">
          {cells.map(cell => { const formatted = cell.value == null ? null : formatSpeed(cell.value, settings.speedUnit), ceiling = cell.ceiling == null ? null : formatSpeed(cell.ceiling, settings.speedUnit); return <button className="v5-metric" key={cell.label} onClick={() => setMetricInfo(cell.label)} aria-label={`${cell.label.toLowerCase()}, ${formatted ? `${formatted.value} ${formatted.unit}` : 'no reading'}. Show metric explanation`}><span className="v5-metric-label">{cell.label}</span><span className="v5-value"><strong>{formatted?.value ?? '—'}</strong><span>{formatted?.unit ?? 'Mbps'}</span></span><small>{ceiling ? `Est. ceiling ${ceiling.value} ${ceiling.unit}` : complete ? 'Ceiling not established' : 'Ceiling available after the test'}</small></button>; })}
          {[{ label: 'PING', value: ping, note: 'Median idle HTTP RTT' }, { label: 'JITTER', value: jitter, note: 'Idle RTT · P95 − P50' }].map(cell => <button className="v5-metric" key={cell.label} onClick={() => setMetricInfo(cell.label)} aria-label={`${cell.label.toLowerCase()}, ${cell.value == null ? 'no reading' : `${cell.value.toFixed(1)} ms`}. Show metric explanation`}><span className="v5-metric-label">{cell.label}</span><span className="v5-value"><strong>{cell.value == null ? '—' : cell.value.toFixed(1)}</strong><span>ms</span></span><small>{cell.note}</small></button>)}
        </div>
        {active && <div className="v5-progress" role="progressbar" aria-label={`${phase} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === 'upload' ? progress.uploadProgress : progress.downloadProgress}><div style={{ width: `${phase === 'upload' ? progress.uploadProgress : progress.downloadProgress}%` }} /></div>}
        {complete && result ? <><p className="v5-help">{measurement?.primaryProviders.download.length === 1 ? 'Single primary source. ' : ''}{measurement?.download.ceilingMbps == null ? 'A repeatable ceiling was not established.' : 'The ceiling is supported by repeated windows.'}</p><button className="v5-details-toggle" aria-expanded={details} aria-controls="measurement-details" onClick={() => setDetails(!details)}>{details ? 'CLOSE DETAILS −' : 'VIEW DETAILS +'} </button></> : <p className="v5-help">{phase === 'error' ? progress.error : settings.dataPolicyAccepted ? 'Cloudflare + M-Lab primary measurements. NDT7 adds a separate single-stream comparison.' : 'Cloudflare-only measurement. Enable M-Lab to compare two primary networks.'}</p>}
      </section>
    </div>
    <footer className="v5-footer"><span>QUBETX / NETWORK INSTRUMENTS</span><span>METHOD {result?.methodologyVersion ?? '5.0'}</span></footer>
    {details && result && <div id="measurement-details"><V5Details result={result} /></div>}
    <dialog ref={explanation} className="v5-metric-dialog" aria-labelledby="metric-explanation-title" onClose={() => setMetricInfo(null)}>
      <h2 id="metric-explanation-title">{metricInfo === 'PING' ? 'Median idle HTTP RTT' : metricInfo === 'JITTER' ? 'Idle latency variation' : 'Sustained throughput'}</h2>
      <p>{metricInfo === 'PING' ? 'The median time for an idle HTTP request to the common Cloudflare reference endpoint. It includes the tested device, browser and path. Minimum HTTP RTT and server TCP minimum RTT have separate labels in Details.' : metricInfo === 'JITTER' ? 'The difference between the 95th percentile and median idle HTTP round-trip time. A larger value means the slower probes took longer relative to a typical probe. It is not packet loss.' : 'Confirmed payload bytes divided by elapsed measurement time after an explicit warm-up. Slow stretches and stalls count. The headline is the median of qualifying primary networks; it describes this device and these paths. Live values show the latest interval while the test is running.'}</p>
      {metricInfo === 'DOWNLOAD' || metricInfo === 'UPLOAD' ? <p>An estimated ceiling needs two non-overlapping windows of at least three seconds within 10%. It can remain unavailable and does not establish the physical capacity of your internet line.</p> : null}
      <form method="dialog"><button autoFocus>Close explanation</button></form>
    </dialog>
  </main>;
}
