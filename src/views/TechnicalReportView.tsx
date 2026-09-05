// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.
import { useNavigate } from 'react-router-dom';
import { colors, fontFamilies } from '../theme/tokens';
import guide from '../services/methodology-guide-v5.json';

export default function TechnicalReportView() {
  const navigate = useNavigate();
  return <main style={{ background: colors.bgCanvas, color: colors.ink, minHeight: '100dvh', overflowY: 'auto', fontFamily: fontFamilies.body }}>
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '32px clamp(20px, 5vw, 48px) 80px' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
        <button onClick={() => navigate(-1)} style={{ padding: '12px 20px', border: '2px solid #111', borderRadius: 30, background: 'transparent', cursor: 'pointer' }}>Back</button>
        <span style={{ fontFamily: fontFamilies.instrument, fontSize: 12 }}>{guide.version}</span>
      </nav>
      <h1 style={{ fontFamily: fontFamilies.display, fontSize: 'clamp(32px, 7vw, 54px)', lineHeight: 1.05, margin: '0 0 24px' }}>{guide.title}</h1>
      <p style={{ fontSize: 21, lineHeight: 1.5, borderBottom: '3px solid #111', paddingBottom: 32 }}>{guide.lead}</p>
      {guide.sections.map((section, i) => <section key={section.title} style={{ marginTop: 40 }}>
        <div style={{ fontFamily: fontFamilies.instrument, fontSize: 12, marginBottom: 12 }}>{String(i + 1).padStart(2, '0')}</div>
        <h2 style={{ fontFamily: fontFamilies.display, fontSize: 25, margin: '0 0 16px' }}>{section.title}</h2>
        {section.paragraphs.map(text => <p key={text} style={{ fontSize: 17, lineHeight: 1.65 }}>{text}</p>)}
      </section>)}
      <footer style={{ borderTop: '2px solid #111', marginTop: 48, paddingTop: 24 }}>
        {guide.links.map(link => <p key={link.url}><a href={link.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textUnderlineOffset: 4 }}>{link.title}</a></p>)}
      </footer>
    </article>
  </main>;
}
