// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import { Link } from 'react-router-dom';
import { useSpeedTestContext } from '../store/SpeedTestContext';
import { useNetworkInfo } from '../hooks/useNetworkInfo';
import type { SpeedUnit } from '../types/speedtest';
import './instrument-v5.css';

const DATA_OPTIONS = [
  { label: 'Profile default', value: undefined }, { label: '250 MB', value: 250_000_000 },
  { label: '1 GB', value: 1_000_000_000 }, { label: '5 GB', value: 5_000_000_000 }, { label: '20 GB', value: 20_000_000_000 },
];
const UNITS: SpeedUnit[] = ['auto', 'Mbps', 'Kbps', 'Gbps'];

export default function SettingsView() {
  const { settings, updateSettings } = useSpeedTestContext();
  const network = useNetworkInfo();
  return <main className="v5-instrument">
    <header className="v5-top"><span className="v5-brand">Settings</span><nav aria-label="Instrument navigation"><Link to="/">Back to test</Link></nav></header>
    <div className="v5-settings">
      <section aria-labelledby="data-policy-heading"><h2 id="data-policy-heading">M-Lab data policy</h2>
        <label className="v5-setting-toggle"><input type="checkbox" checked={settings.dataPolicyAccepted} onChange={e => updateSettings({ dataPolicyAccepted: e.target.checked })} /><span>Allow M-Lab to publish my IP address and measurement results.</span></label>
        <p>Consent enables MSAK as a second primary network and NDT7 as a separate single-stream comparison. Without consent, Cloudflare supplies the primary result. <a href="https://www.measurementlab.net/tests/ndt/" target="_blank" rel="noreferrer">Read M-Lab's data policy</a>.</p>
      </section>
      <section aria-labelledby="data-ceiling-heading"><h2 id="data-ceiling-heading">Data ceiling</h2>
        <p>Quick ends within 90 seconds; Deep within five minutes. Their default ceilings allow up to 5 GB and 20 GB of synthetic payload. Protocol overhead is additional. Limits preserve usable partial results.</p>
        <div className="v5-setting-choices" aria-label="Payload ceiling">{DATA_OPTIONS.map(option => <button key={option.label} aria-pressed={settings.maxBytes === option.value} onClick={() => updateSettings({ maxBytes: option.value })}>{option.label}</button>)}</div>
      </section>
      <section aria-labelledby="units-heading"><h2 id="units-heading">Display units</h2>
        <div className="v5-setting-choices" aria-label="Speed display units">{UNITS.map(unit => <button key={unit} aria-pressed={settings.speedUnit === unit} onClick={() => updateSettings({ speedUnit: unit })}>{unit === 'auto' ? 'Auto' : unit}</button>)}</div>
      </section>
      <section aria-labelledby="options-heading"><h2 id="options-heading">Options</h2>
        <label className="v5-setting-toggle"><input type="checkbox" checked={settings.autoCopyResults} onChange={e => updateSettings({ autoCopyResults: e.target.checked })} /><span>Automatically copy completed results</span></label>
        <label className="v5-setting-toggle"><input type="checkbox" checked={settings.soundEffects} onChange={e => updateSettings({ soundEffects: e.target.checked })} /><span>Sound effects</span></label>
        <p>Motion follows your system's reduced-motion preference.</p>
      </section>
      {network.available && network.type ? <section><h2>Connection</h2><p>{network.type}</p></section> : null}
    </div>
    <footer className="v5-footer"><span>QUBETX / NETWORK INSTRUMENTS</span><Link to="/how-it-works">Methodology 5</Link></footer>
  </main>;
}
