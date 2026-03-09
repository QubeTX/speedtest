import React, { useState, useEffect, useRef } from 'react';

const customStyles = {
  root: {
    '--bg-canvas': '#f4f4f4',
    '--bg-device': '#e9e9e9',
    '--bg-screen': '#dbdbdb',
    '--ink': '#111111',
    '--paper': '#ffffff',
    '--stroke': '3px',
    '--radius-pill': '999px',
    '--radius-box': '16px',
  },
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
  mechanismCore: {
    width: '180px',
    height: '380px',
    border: '3px solid #111111',
    borderRadius: '999px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '10px',
    marginBottom: '3rem',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
  },
  mechanismCorePseudo: {
    content: "''",
    position: 'absolute',
    top: '80px',
    bottom: '80px',
    left: '20px',
    right: '20px',
    borderLeft: '3px solid #111111',
    borderRight: '3px solid #111111',
    zIndex: 1,
  },
  reel: {
    width: '154px',
    height: '154px',
    border: '3px solid #111111',
    borderRadius: '50%',
    backgroundColor: '#dbdbdb',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  hub: {
    width: '40px',
    height: '40px',
    backgroundColor: '#111111',
    borderRadius: '50%',
    position: 'relative',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 0,
    height: 0,
    borderTop: '15px solid transparent',
    borderBottom: '15px solid transparent',
    borderLeft: '24px solid #111111',
    zIndex: 3,
    transition: 'opacity 0.2s',
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
    marginBottom: '1rem',
    height: '1.5em',
  },
  panelData: {
    backgroundColor: '#dbdbdb',
    display: 'flex',
    flexDirection: 'column',
  },
  dataRow: {
    flex: 1,
    borderBottom: '3px solid #111111',
    padding: '2rem 3rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
  },
  dataRowActive: {
    backgroundColor: '#ffffff',
  },
  dataRowLast: {
    borderBottom: 'none',
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
    fontWeight: 500,
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
  numberSplit: {
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
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
  },
  progressContainer: {
    height: '8px',
    width: '100%',
    border: '2px solid #111111',
    marginTop: '1.5rem',
    borderRadius: '999px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#111111',
    transition: 'width 0.1s linear',
  },
  sysInfo: {
    position: 'absolute',
    bottom: '1.5rem',
    left: '2rem',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    opacity: 0.6,
    lineHeight: 1.6,
  },
};

const App = () => {
  const [time, setTime] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [statusText, setStatusText] = useState('PRESS TO START');

  const [valPing, setValPing] = useState('--');
  const [valJitter, setValJitter] = useState('--');
  const [valDl, setValDl] = useState('---');
  const [valUl, setValUl] = useState('---');

  const [progDl, setProgDl] = useState(0);
  const [progUl, setProgUl] = useState(0);

  const [metaDl, setMetaDl] = useState('IDLE');
  const [metaUl, setMetaUl] = useState('IDLE');

  const [activePing, setActivePing] = useState(false);
  const [activeDl, setActiveDl] = useState(false);
  const [activeUl, setActiveUl] = useState(false);

  const [topReelSpin, setTopReelSpin] = useState(false);
  const [bottomReelSpin, setBottomReelSpin] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(true);
  const [mechActive, setMechActive] = useState(false);

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

  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
      body { background-color: #f4f4f4; -webkit-font-smoothing: antialiased; }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .hub-spin { animation: spin 0.4s linear infinite; }
      @media (max-width: 900px) {
        .apparatus-responsive { grid-template-columns: 1fr !important; max-width: 500px !important; }
        .apparatus-responsive .divider { display: none !important; }
        .panel-data-responsive { border-top: 3px solid #111111; }
        .mechanism-core-responsive { transform: scale(0.8); margin-bottom: 1rem !important; }
        .number-responsive { font-size: 5rem !important; }
        .number-split-responsive { font-size: 3rem !important; }
        .data-row-responsive { padding: 1.5rem 2rem !important; }
      }
    `;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  function easeOutExpo(x) {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  }

  function animateValue(setter, start, end, duration, decimalPlaces = 0, progressSetter = null) {
    return new Promise((resolve) => {
      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let currentVal = start + (end - start) * easeOutExpo(progress);
        if (progress < 1) {
          currentVal = currentVal + (Math.random() * currentVal * 0.1 - currentVal * 0.05);
        } else {
          currentVal = end;
        }
        setter(Math.max(0, currentVal).toFixed(decimalPlaces));
        if (progressSetter) {
          progressSetter(progress * 100);
        }
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      window.requestAnimationFrame(step);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const handleStart = async () => {
    if (isRunning) return;
    setIsRunning(true);

    setValPing('--');
    setValJitter('--');
    setValDl('---');
    setValUl('---');
    setProgDl(0);
    setProgUl(0);
    setActivePing(false);
    setActiveDl(false);
    setActiveUl(false);
    setMetaDl('WAITING');
    setMetaUl('WAITING');
    setShowPlayIcon(false);
    setMechActive(true);

    const targetPing = 12;
    const targetJitter = 2;
    const targetDl = 842;
    const targetUl = 315;

    setStatusText('MEASURING LATENCY');
    setActivePing(true);
    await sleep(500);
    animateValue(setValPing, 40, targetPing, 1000, 0);
    animateValue(setValJitter, 15, targetJitter, 1000, 0);
    await sleep(1200);
    setActivePing(false);

    setStatusText('TESTING DOWNLOAD');
    setTopReelSpin(true);
    setActiveDl(true);
    setMetaDl('ACTIVE');
    await animateValue(setValDl, 0, targetDl, 3500, 0, setProgDl);
    setTopReelSpin(false);
    setActiveDl(false);
    setMetaDl('COMPLETE');

    setStatusText('TESTING UPLOAD');
    setBottomReelSpin(true);
    setActiveUl(true);
    setMetaUl('ACTIVE');
    await animateValue(setValUl, 0, targetUl, 3000, 0, setProgUl);
    setBottomReelSpin(false);
    setActiveUl(false);
    setMetaUl('COMPLETE');

    setStatusText('TEST COMPLETE');
    setShowPlayIcon(true);
    setMechActive(false);
    setIsRunning(false);
  };

  return (
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
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div
        className="apparatus-responsive"
        style={customStyles.apparatus}
      >
        {/* Divider */}
        <div className="divider" style={customStyles.apparatusDivider} />

        {/* Left Panel - Mechanism */}
        <div style={customStyles.panelMech}>
          <div style={customStyles.topBar}>
            <span>SYS.TEST.01</span>
            <span>{time}</span>
          </div>

          <div style={customStyles.statusText}>{statusText}</div>

          <div
            className="mechanism-core-responsive"
            style={customStyles.mechanismCore}
            onClick={handleStart}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {/* Inner vertical rails pseudo-element */}
            <div style={customStyles.mechanismCorePseudo} />

            {/* Play icon */}
            <div
              style={{
                ...customStyles.playIcon,
                opacity: showPlayIcon ? 1 : 0,
              }}
            />

            {/* Top Reel */}
            <div style={customStyles.reel}>
              <div
                className={topReelSpin ? 'hub-spin' : ''}
                style={customStyles.hub}
              />
            </div>

            {/* Bottom Reel */}
            <div style={customStyles.reel}>
              <div
                className={bottomReelSpin ? 'hub-spin' : ''}
                style={customStyles.hub}
              />
            </div>
          </div>

          <div style={customStyles.speakerGrill} />

          <div style={customStyles.sysInfo}>
            SERVER: OPT_NY_04<br />
            PROTOCOL: TCP/IPv4
          </div>
        </div>

        {/* Right Panel - Data */}
        <div className="panel-data-responsive" style={customStyles.panelData}>

          {/* Ping / Jitter Row */}
          <div
            className="data-row-responsive"
            style={{
              ...customStyles.dataRow,
              ...customStyles.splitRow,
              ...(activePing ? customStyles.dataRowActive : {}),
            }}
          >
            <div style={customStyles.crosshairTL} />
            <div>
              <div style={customStyles.labelGroup}>
                <span style={customStyles.metaLabel}>PING</span>
              </div>
              <div style={customStyles.valueDisplay}>
                <span className="number-split-responsive" style={customStyles.numberSplit}>{valPing}</span>
                <span style={customStyles.unit}>ms</span>
              </div>
            </div>
            <div>
              <div style={customStyles.labelGroup}>
                <span style={customStyles.metaLabel}>JITTER</span>
              </div>
              <div style={customStyles.valueDisplay}>
                <span className="number-split-responsive" style={customStyles.numberSplit}>{valJitter}</span>
                <span style={customStyles.unit}>ms</span>
              </div>
            </div>
            <div style={customStyles.crosshairBR} />
          </div>

          {/* Download Row */}
          <div
            className="data-row-responsive"
            style={{
              ...customStyles.dataRow,
              ...(activeDl ? customStyles.dataRowActive : {}),
            }}
          >
            <div style={customStyles.crosshairTL} />
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>DOWNLOAD SPEED</span>
              <span style={customStyles.metaValue}>{metaDl}</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span className="number-responsive" style={customStyles.number}>{valDl}</span>
              <span style={customStyles.unit}>Mbps</span>
            </div>
            {activeDl && (
              <div style={customStyles.progressContainer}>
                <div style={{ ...customStyles.progressFill, width: `${progDl}%` }} />
              </div>
            )}
            <div style={customStyles.crosshairBR} />
          </div>

          {/* Upload Row */}
          <div
            className="data-row-responsive"
            style={{
              ...customStyles.dataRow,
              ...customStyles.dataRowLast,
              ...(activeUl ? customStyles.dataRowActive : {}),
            }}
          >
            <div style={customStyles.crosshairTL} />
            <div style={customStyles.labelGroup}>
              <span style={customStyles.metaLabel}>UPLOAD SPEED</span>
              <span style={customStyles.metaValue}>{metaUl}</span>
            </div>
            <div style={customStyles.valueDisplay}>
              <span className="number-responsive" style={customStyles.number}>{valUl}</span>
              <span style={customStyles.unit}>Mbps</span>
            </div>
            {activeUl && (
              <div style={customStyles.progressContainer}>
                <div style={{ ...customStyles.progressFill, width: `${progUl}%` }} />
              </div>
            )}
            <div style={customStyles.crosshairBR} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;