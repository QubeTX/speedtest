import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const customStyles = {
  apparatus: {
    width: '100%',
    maxWidth: '1200px',
    backgroundColor: '#e9e9e9',
    border: '3px solid #111111',
    borderRadius: '16px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
  },
  apparatusDivider: {
    content: '',
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
    padding: '3rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topBar: {
    position: 'absolute',
    top: '1.5rem',
    left: '2rem',
    right: '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.05em',
  },
  resultsStamp: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(-12deg)',
    border: '8px solid #111111',
    padding: '1rem 2rem',
    fontWeight: 800,
    fontSize: '3.5rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    zIndex: 20,
    background: '#e9e9e9',
    mixBlendMode: 'multiply',
    opacity: 0.9,
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    width: '240px',
    height: '80px',
    backgroundColor: '#111111',
    color: '#ffffff',
    border: 'none',
    borderRadius: '999px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: '1.25rem',
    fontWeight: 600,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginTop: '2rem',
    transition: 'transform 0.1s ease, background-color 0.2s',
  },
  actionBtnHover: {
    backgroundColor: '#333',
  },
  actionBtnActive: {
    transform: 'scale(0.96)',
  },
  speakerGrill: {
    width: '100%',
    height: '100px',
    backgroundImage: 'radial-gradient(circle, #111111 2.5px, transparent 3px)',
    backgroundSize: '16px 16px',
    backgroundPosition: 'center',
    opacity: 0.9,
    marginTop: 'auto',
  },
  statusText: {
    fontSize: '1.25rem',
    fontWeight: 500,
    marginBottom: '2rem',
    height: '1.5em',
    letterSpacing: '0.05em',
  },
  panelData: {
    backgroundColor: '#dbdbdb',
    display: 'flex',
    flexDirection: 'column',
  },
  dataRow: {
    flex: 1,
    borderBottom: '3px solid #111111',
    padding: '2.5rem 3rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
  },
  dataRowLast: {
    flex: 1,
    padding: '2.5rem 3rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
  },
  labelGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '0.5rem',
  },
  metaLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 600,
    color: '#111111',
  },
  metaValue: {
    fontSize: '0.85rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  valueDisplay: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
  },
  number: {
    fontSize: '7rem',
    fontWeight: 500,
    lineHeight: 0.8,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums',
  },
  numberSmall: {
    fontSize: '4rem',
    fontWeight: 500,
    lineHeight: 0.8,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums',
  },
  unit: {
    fontSize: '1.5rem',
    fontWeight: 500,
  },
  crosshairTL: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    top: '10px',
    left: '10px',
    borderTop: '2px solid #111111',
    borderLeft: '2px solid #111111',
  },
  crosshairBR: {
    position: 'absolute',
    width: '10px',
    height: '10px',
    bottom: '10px',
    right: '10px',
    borderBottom: '2px solid #111111',
    borderRight: '2px solid #111111',
  },
  splitRow: {
    flex: 1,
    borderBottom: '3px solid #111111',
    padding: '2.5rem 3rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
    position: 'relative',
    alignItems: 'center',
  },
  sysInfo: {
    position: 'absolute',
    bottom: '1.5rem',
    left: '2rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.6,
  },
  refreshIcon: {
    width: '20px',
    height: '20px',
    fill: 'currentColor',
  },
};

const SpeedTestPage = () => {
  const [time, setTime] = useState('');
  const [btnHover, setBtnHover] = useState(false);
  const [btnActive, setBtnActive] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setTime(timeString);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRunAgain = () => {
    setKey(prev => prev + 1);
  };

  const getBtnStyle = () => {
    let style = { ...customStyles.actionBtn };
    if (btnHover) style = { ...style, ...customStyles.actionBtnHover };
    if (btnActive) style = { ...style, ...customStyles.actionBtnActive };
    return style;
  };

  return (
    <div style={customStyles.apparatus} key={key}>
      <div style={customStyles.apparatusDivider} />

      {/* Left Panel */}
      <div style={customStyles.panelMech}>
        <div style={customStyles.topBar}>
          <span>SYS.TEST.01</span>
          <span>{time}</span>
        </div>

        <div style={customStyles.resultsStamp}>TEST COMPLETE</div>

        <div style={customStyles.statusText}>SYSTEM STANDBY</div>

        <button
          style={getBtnStyle()}
          onClick={handleRunAgain}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => { setBtnHover(false); setBtnActive(false); }}
          onMouseDown={() => setBtnActive(true)}
          onMouseUp={() => setBtnActive(false)}
        >
          <svg style={customStyles.refreshIcon} viewBox="0 0 24 24">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
          RUN AGAIN
        </button>

        <div style={customStyles.speakerGrill} />

        <div style={customStyles.sysInfo}>
          SERVER: OPT_NY_04<br />
          PROTOCOL: TCP/IPv4
        </div>
      </div>

      {/* Right Panel */}
      <div style={customStyles.panelData}>

        {/* Ping & Jitter Row */}
        <div style={customStyles.splitRow}>
          <div style={customStyles.crosshairTL} />
          <div>
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>PING</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span style={customStyles.numberSmall}>12</span>
              <span style={customStyles.unit}>ms</span>
            </div>
          </div>
          <div>
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>JITTER</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span style={customStyles.numberSmall}>2</span>
              <span style={customStyles.unit}>ms</span>
            </div>
          </div>
          <div style={customStyles.crosshairBR} />
        </div>

        {/* Download Speed Row */}
        <div style={customStyles.dataRow}>
          <div style={customStyles.crosshairTL} />
          <div style={customStyles.labelGroup}>
            <span style={customStyles.metaLabel}>DOWNLOAD SPEED</span>
            <span style={customStyles.metaValue}>FINAL</span>
          </div>
          <div style={customStyles.valueDisplay}>
            <span style={customStyles.number}>842</span>
            <span style={customStyles.unit}>Mbps</span>
          </div>
          <div style={customStyles.crosshairBR} />
        </div>

        {/* Upload Speed Row */}
        <div style={customStyles.dataRowLast}>
          <div style={customStyles.crosshairTL} />
          <div style={customStyles.labelGroup}>
            <span style={customStyles.metaLabel}>UPLOAD SPEED</span>
            <span style={customStyles.metaValue}>FINAL</span>
          </div>
          <div style={customStyles.valueDisplay}>
            <span style={customStyles.number}>315</span>
            <span style={customStyles.unit}>Mbps</span>
          </div>
          <div style={customStyles.crosshairBR} />
        </div>

      </div>
    </div>
  );
};

const App = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body { background-color: #f4f4f4; -webkit-font-smoothing: antialiased; }
      @media (max-width: 900px) {
        .apparatus-responsive {
          grid-template-columns: 1fr !important;
          max-width: 500px !important;
        }
        .apparatus-responsive .divider { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <Router basename="/">
      <div
        style={{
          backgroundColor: '#f4f4f4',
          color: '#111111',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <Routes>
          <Route path="/" element={<SpeedTestPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;