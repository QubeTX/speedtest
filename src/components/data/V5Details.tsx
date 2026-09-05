// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { useState } from 'react';
import type { SpeedTestResult } from '../../types/speedtest';
import { estimateTrace, latencyStatistics } from '../../services/measurement-v5';

export default function V5Details({ result }: { result: SpeedTestResult }) {
  const [traceIndex, setTraceIndex] = useState(0), [sampleIndex, setSampleIndex] = useState(0);
  const measurement = result.measurement, traces = measurement?.traces ?? [], trace = traces[traceIndex];
  const samples = trace?.points.slice(1).map((point, i) => ({ t: point.t / 1000, rate: (point.bytes - trace.points[i].bytes) * .008 / (point.t - trace.points[i].t), valid: point.valid !== false && trace.points[i].valid !== false })) ?? [];
  const peak = Math.max(1, ...samples.map(s => s.rate)), selected = samples[Math.min(sampleIndex, samples.length - 1)];
  const lastTime = Math.max(0.001, samples[samples.length - 1]?.t ?? 0);
  const x = (time: number) => time / lastTime * 560;
  const selectedX = selected ? x(selected.t) : 0;
  const estimate = trace ? estimateTrace(trace) : null;
  const rate = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)} Mbps`;
  return <div className="v5-details">
    <h2>Behind the measurement</h2>
    <p>Sustained throughput describes this device and the tested paths. An estimated ceiling needs two separate, comparable three-second windows.</p>
    {result.warnings?.length ? <ul>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul> : null}
    {measurement && <section><h3>Evidence and observed variation</h3>{(['download', 'upload'] as const).map(direction => {
      const value = measurement[direction], providers = measurement.primaryProviders[direction];
      return <p key={direction}>{direction}: {providers.length > 1 ? 'Two primary networks' : providers.length === 1 ? 'Single primary source' : 'Insufficient evidence'}{value.repeatability ? ` · ${providers.length > 1 ? 'provider spread' : 'observed window range'} ${rate(value.repeatability.lower)}–${rate(value.repeatability.upper)}` : ''}.</p>;
    })}</section>}
    <table><thead><tr><th>Source</th><th>Download</th><th>Upload</th></tr></thead><tbody>{result.providers?.map((p, i) => <tr key={`${p.provider}-${i}`}><th>{p.name}<small>{p.provider === 'cloudflare' || p.provider === 'msak' ? 'Primary' : p.provider === 'ndt7' ? 'Single stream · same M-Lab network' : 'Supplementary'}</small></th><td>{rate(p.downloadMbps)}</td><td>{rate(p.uploadMbps)}</td></tr>)}</tbody></table>
    {trace && <section>
      <label htmlFor="trace-source">Recorded transfer</label>
      <select id="trace-source" value={traceIndex} onChange={event => { setTraceIndex(Number(event.target.value)); setSampleIndex(0); }}>{traces.map((t, i) => <option value={i} key={i}>{i + 1}. {t.provider} · {t.direction}</option>)}</select>
      <svg viewBox="0 0 560 120" role="img" aria-label="Chronological throughput trace; inspect individual samples with the slider below">
        <path d="M0 100H560M0 50H560" stroke="#111" strokeOpacity=".15" />
        <path d={`M${x(trace.warmupMs / 1000)} 8V105`} stroke="#777" strokeDasharray="3 3" />
        <path d={samples.map((s, i) => `${i && s.valid && samples[i - 1].valid ? 'L' : 'M'}${x(s.t)},${100 - Math.max(0, s.rate) / peak * 90}`).join(' ')} stroke="#111" strokeWidth="2" fill="none" />
        <path d={`M${selectedX} 8V105`} stroke="#111" strokeDasharray="3 3" />
      </svg>
      <input aria-label="Inspect recorded throughput sample" type="range" min="0" max={Math.max(0, samples.length - 1)} value={Math.min(sampleIndex, Math.max(0, samples.length - 1))} onChange={event => setSampleIndex(Number(event.target.value))} />
      <output>{selected ? `${selected.t.toFixed(2)} s · ${selected.rate.toFixed(1)} Mbps${selected.t <= trace.warmupMs / 1000 ? ' · warm-up' : ''}${!selected.valid ? ' · excluded interval' : ''}` : 'No recorded intervals'}</output>
      <p>{trace.streams} logical stream{trace.streams === 1 ? '' : 's'} · {trace.accounting} bytes · {trace.endpoint}</p>
      {estimate && <p>Sustained {rate(estimate.sustainedMbps)} · {estimate.qualification} · estimated ceiling {rate(estimate.ceilingMbps)}.</p>}
      {trace.serverTcpMinRttMs != null && <p>Server TCP minimum RTT: {trace.serverTcpMinRttMs.toFixed(1)} ms.</p>}
      {estimate?.warnings.length ? <ul>{estimate.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
    </section>}
    {result.httpLatency && <section><h3>HTTP round-trip time</h3><p>Every latency figure below uses the same Cloudflare HTTP reference. HTTP failures are not UDP packet loss or TCP retransmissions.</p><table><thead><tr><th>Condition</th><th>Median / P95</th><th>Failed probes</th></tr></thead><tbody>{(['idle', 'download', 'upload'] as const).map(kind => {
      const values = result.httpLatency![kind], stats = values.length ? latencyStatistics(values) : null;
      return <tr key={kind}><th>{kind === 'idle' ? 'Idle' : `${kind}-loaded`}</th><td>{stats ? `${stats.p50.toFixed(1)} / ${stats.p95.toFixed(1)} ms` : 'Unavailable'}</td><td>{result.httpLatency!.failures[kind]} / {result.httpLatency!.attempts[kind]}</td></tr>;
    })}</tbody></table><p>Minimum idle HTTP RTT: {result.latencyStats ? `${result.latencyStats.min.toFixed(1)} ms` : 'Unavailable'}.</p></section>}
    {measurement && <section><h3>Run record</h3><p>{(measurement.bytesTransferred / 1e6).toFixed(1)} MB confirmed payload · {(measurement.budgetBytes / 1e6).toFixed(1)} MB charged against the {(measurement.byteLimit / 1e6).toFixed(0)} MB limit · {(measurement.elapsedMs / 1000).toFixed(1)} seconds · ended: {measurement.stopReason}.</p>
      <p>The data budget counts received payload and upload payload offered to the transport. Confirmed payload counts received downloads and acknowledged uploads. Protocol overhead is additional.</p>
      <p>Observed ranges describe variation in this run. They are not a calibrated 95% accuracy guarantee. UDP loss and TCP retransmissions are unavailable in this profile.</p>
    </section>}
    {result.networkMetadata && <section><h3>Connection details</h3><p>{[result.networkMetadata.ispFull, result.networkMetadata.ip, result.networkMetadata.city, result.networkMetadata.country].filter(Boolean).join(' · ')}</p></section>}
    {result.dnsCheck && <section><h3>Browser reachability checks</h3><p>These auxiliary HTTP requests ran after the measurement. Their total time includes more than DNS resolution.</p><ul>{result.dnsCheck.probes.map(probe => <li key={probe.domain}>{probe.domain}: {probe.status === 'pass' ? `${probe.totalMs} ms total${probe.dnsMs == null ? '' : ` · DNS ${probe.dnsMs} ms`}` : 'Request failed'}</li>)}</ul></section>}
  </div>;
}
