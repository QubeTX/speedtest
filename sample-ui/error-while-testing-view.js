import React, { useState, useEffect, useRef } from 'react';

const customStyles = {
  apparatus: {
    width: '1440px',
    height: '900px',
    backgroundColor: '#e9e9e9',
    border: '3px solid #111111',
    borderRadius: '16px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 40px 80px rgba(0,0,0,0.1)',
  },
  apparatusAfter: {
    content: "''",
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '3px',
    backgroundColor: '#111111',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  panelMech: {
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: '2rem',
    left: '3rem',
    right: '3rem',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
  },
  mechanismCore: {
    width: '220px',
    height: '460px',
    border: '3px solid #111111',
    borderRadius: '999px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '15px',
    marginBottom: '4rem',
    background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 59, 48, 0.05) 10px, rgba(255, 59, 48, 0.05) 20px)',
  },
  reel: {
    width: '184px',
    height: '184px',
    border: '3px solid #111111',
    borderRadius: '50%',
    backgroundColor: '#dbdbdb',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  hub: {
    width: '48px',
    height: '48px',
    backgroundColor: '#111111',
    borderRadius: '50%',
    position: 'relative',
  },
  alertIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontWeight: 800,
    fontSize: '3rem',
    color: '#ff3b30',
    zIndex: 5,
  },
  speakerGrill: {
    width: '80%',
    height: '120px',
    backgroundImage: 'radial-gradient(circle, #111111 2.5px, transparent 3px)',
    backgroundSize: '20px 20px',
    backgroundPosition: 'center',
    opacity: 0.8,
    marginTop: 'auto',
  },
  statusText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '2rem',
    color: '#ff3b30',
    letterSpacing: '0.05em',
  },
  panelData: {
    backgroundColor: '#dbdbdb',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  panelDataOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))',
    zIndex: 5,
    backgroundSize: '100% 4px, 3px 100%',
    pointerEvents: 'none',
  },
  dataRow: {
    flex: 1,
    borderBottom: '3px solid #111111',
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  dataRowLast: {
    flex: 1,
    padding: '4rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  labelGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '1rem',
  },
  metaLabel: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontWeight: 700,
  },
  metaValue: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ff3b30',
  },
  valueDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  glitchText: {
    fontSize: '6rem',
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    position: 'relative',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  diagnostics: {
    marginTop: '2rem',
    fontSize: '0.75rem',
    lineHeight: 1.6,
    color: '#111111',
    borderTop: '1px solid #111111',
    paddingTop: '1rem',
    fontFamily: 'monospace',
  },
  sysInfo: {
    position: 'absolute',
    bottom: '2rem',
    left: '3rem',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    lineHeight: 1.6,
    letterSpacing: '0.1em',
    opacity: 0.8,
  },
  chTl: {
    position: 'absolute',
    width: '12px',
    height: '12px',
    top: '15px',
    left: '15px',
    borderTop: '2px solid #111111',
    borderLeft: '2px solid #111111',
  },
  chBr: {
    position: 'absolute',
    width: '12px',
    height: '12px',
    bottom: '15px',
    right: '15px',
    borderBottom: '2px solid #111111',
    borderRight: '2px solid #111111',
  },
};

const GlitchText = ({ children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (ref.current) {
        const shift = (Math.random() - 0.5) * 2;
        ref.current.style.transform = `translateX(${shift}px)`;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <span ref={ref} style={customStyles.glitchText}>
      {children}
    </span>
  );
};

const App = () => {
  const [errorTag] = useState('0x000F4');
  const [blinkVisible, setBlinkVisible] = useState(true);

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        user-select: none;
      }

      body {
        background-color: #f4f4f4;
        color: #111111;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        -webkit-font-smoothing: antialiased;
      }

      .error-tag-blink {
        color: #ff3b30;
        font-weight: 700;
        animation: blink 1s step-end infinite;
      }

      @keyframes blink {
        50% { opacity: 0; }
      }

      .glitch-text-pseudo {
        position: relative;
      }

      .glitch-text-pseudo::after {
        content: 'NO SIGNAL';
        position: absolute;
        left: 2px;
        text-shadow: -1px 0 #ff3b30;
        top: 0;
        background: #dbdbdb;
        overflow: hidden;
        clip: rect(0, 900px, 0, 0);
        animation: glitch-anim 2s infinite linear alternate-reverse;
      }

      @keyframes glitch-anim {
        0% { clip: rect(10px, 9999px, 40px, 0); }
        20% { clip: rect(60px, 9999px, 10px, 0); }
        40% { clip: rect(30px, 9999px, 80px, 0); }
        60% { clip: rect(70px, 9999px, 50px, 0); }
        80% { clip: rect(20px, 9999px, 90px, 0); }
        100% { clip: rect(50px, 9999px, 30px, 0); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  return (
    <div style={{
      backgroundColor: '#f4f4f4',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={customStyles.apparatus}>
        {/* Divider line */}
        <div style={customStyles.apparatusAfter} />

        {/* Left Panel - Mechanical */}
        <div style={customStyles.panelMech}>
          <div style={customStyles.topBar}>
            <span>SYS.TEST.01 // ERROR</span>
            <span className="error-tag-blink">{errorTag}</span>
          </div>

          <div style={customStyles.statusText}>CONNECTION FAILURE</div>

          <div style={customStyles.mechanismCore}>
            <div style={customStyles.alertIndicator}>!</div>
            <div style={customStyles.reel}>
              <div style={customStyles.hub} />
            </div>
            <div style={customStyles.reel}>
              <div style={customStyles.hub} />
            </div>
          </div>

          <div style={customStyles.speakerGrill} />

          <div style={customStyles.sysInfo}>
            GATEWAY: UNREACHABLE<br />
            DNS_PROBE_FINISHED_NXDOMAIN<br />
            TIMESTAMP: 14:22:09.11
          </div>
        </div>

        {/* Right Panel - Data */}
        <div style={customStyles.panelData}>
          {/* CRT overlay */}
          <div style={customStyles.panelDataOverlay} />

          {/* Row 1 */}
          <div style={customStyles.dataRow}>
            <div style={customStyles.chTl} />
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>LATENCY_BUFFER</span>
              <span style={customStyles.metaValue}>FAILED</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span className="glitch-text-pseudo" style={customStyles.glitchText}>
                <GlitchTextInner>NO SIGNAL</GlitchTextInner>
              </span>
            </div>
            <div style={customStyles.chBr} />
          </div>

          {/* Row 2 */}
          <div style={customStyles.dataRow}>
            <div style={customStyles.chTl} />
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>RX_DOWNLINK</span>
              <span style={customStyles.metaValue}>TIMEOUT</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span className="glitch-text-pseudo" style={customStyles.glitchText}>
                <GlitchTextInner>NO SIGNAL</GlitchTextInner>
              </span>
            </div>
            <div style={customStyles.diagnostics}>
              [SYSTEM_DIAGNOSTICS]<br />
              &gt; Possible <strong style={{ color: '#ff3b30' }}>Firewall Interruption</strong> detected.<br />
              &gt; Handshake sequence timed out at 4000ms.<br />
              &gt; Check physical uplink or local security policy.
            </div>
            <div style={customStyles.chBr} />
          </div>

          {/* Row 3 */}
          <div style={customStyles.dataRowLast}>
            <div style={customStyles.chTl} />
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>TX_UPLINK</span>
              <span style={customStyles.metaValue}>OFFLINE</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span className="glitch-text-pseudo" style={customStyles.glitchText}>
                <GlitchTextInner>NO SIGNAL</GlitchTextInner>
              </span>
            </div>
            <div style={customStyles.chBr} />
          </div>
        </div>
      </div>
    </div>
  );
};

const GlitchTextInner = ({ children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (ref.current) {
        const shift = (Math.random() - 0.5) * 2;
        ref.current.style.transform = `translateX(${shift}px)`;
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      {children}
    </span>
  );
};

export default App;