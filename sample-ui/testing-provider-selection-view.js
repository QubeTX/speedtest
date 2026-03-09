import React, { useState, useEffect } from 'react';

const servers = [
  { id: 'OPT_NY_04', latency: 12, angle: -135 },
  { id: 'OPT_LA_02', latency: 64, angle: -90 },
  { id: 'EUR_LN_07', latency: 108, angle: -45 },
  { id: 'ASIA_TK_12', latency: 245, angle: 0 },
  { id: 'AUS_SY_01', latency: 290, angle: 45 },
  { id: 'SA_SP_03', latency: 182, angle: 90 },
];

const styles = {
  body: {
    backgroundColor: '#f4f4f4',
    color: '#111111',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    WebkitFontSmoothing: 'antialiased',
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
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '3px',
    backgroundColor: '#111111',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  panelDial: {
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
  rotaryAssembly: {
    width: '320px',
    height: '320px',
    border: '3px solid #111111',
    borderRadius: '50%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e9e9',
    marginBottom: '2rem',
  },
  dialKnobBase: {
    width: '180px',
    height: '180px',
    backgroundColor: '#dbdbdb',
    border: '3px solid #111111',
    borderRadius: '50%',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    zIndex: 5,
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
  },
  dialKnobIndicator: {
    content: '',
    position: 'absolute',
    top: '15px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '8px',
    height: '30px',
    backgroundColor: '#111111',
    borderRadius: '4px',
  },
  dialTick: {
    position: 'absolute',
    width: '2px',
    height: '12px',
    backgroundColor: '#111111',
    left: '50%',
    top: '15px',
    transformOrigin: '50% 145px',
  },
  statusText: {
    fontSize: '1.25rem',
    fontWeight: 500,
    marginBottom: '2rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  speakerGrill: {
    width: '100%',
    height: '80px',
    backgroundImage: 'radial-gradient(circle, #111111 2.5px, transparent 3px)',
    backgroundSize: '16px 16px',
    backgroundPosition: 'center',
    opacity: 0.9,
    marginTop: 'auto',
  },
  panelList: {
    backgroundColor: '#dbdbdb',
    display: 'flex',
    flexDirection: 'column',
  },
  serverRowBase: {
    flex: 1,
    borderBottom: '3px solid #111111',
    padding: '0 3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    transition: 'background-color 0.2s ease',
    cursor: 'pointer',
  },
  serverRowActive: {
    backgroundColor: '#ffffff',
  },
  serverRowFlash: {
    backgroundColor: '#111111',
    color: '#ffffff',
  },
  serverRowLastChild: {
    borderBottom: 'none',
  },
  serverId: {
    fontSize: '1.5rem',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  serverMeta: {
    textAlign: 'right',
  },
  latencyVal: {
    fontSize: '2.5rem',
    fontWeight: 500,
    display: 'block',
    lineHeight: 1,
  },
  latencyUnit: {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  crosshairBase: {
    position: 'absolute',
    width: '10px',
    height: '10px',
  },
  chTL: {
    top: '10px',
    left: '10px',
    borderTop: '2px solid #111111',
    borderLeft: '2px solid #111111',
  },
  chBR: {
    bottom: '10px',
    right: '10px',
    borderBottom: '2px solid #111111',
    borderRight: '2px solid #111111',
  },
  actionButton: {
    position: 'absolute',
    bottom: '1.5rem',
    left: '2rem',
    padding: '0.75rem 1.5rem',
    border: '3px solid #111111',
    background: 'transparent',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
};

const tickAngles = [-135, -90, -45, 0, 45, 90];

const App = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [flashIndex, setFlashIndex] = useState(null);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setCurrentTime(timeString);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRowHover = (index) => {
    setActiveIndex(index);
  };

  const handleRowClick = (index) => {
    setFlashIndex(index);
    setTimeout(() => {
      setFlashIndex(null);
    }, 150);
  };

  const handleKnobClick = () => {
    setActiveIndex((prev) => (prev + 1) % servers.length);
  };

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 300);
  };

  const knobAngle = servers[activeIndex].angle;

  return (
    <div style={styles.body}>
      <div style={styles.apparatus}>
        <div style={styles.divider} />

        {/* Left Panel - Dial */}
        <div style={styles.panelDial}>
          <div style={styles.topBar}>
            <span>SYS.CFG.SRV</span>
            <span>{currentTime}</span>
          </div>

          <div style={styles.statusText}>SELECT NODE</div>

          <div style={styles.rotaryAssembly}>
            {tickAngles.map((angle) => (
              <div
                key={angle}
                style={{
                  ...styles.dialTick,
                  transform: `rotate(${angle}deg)`,
                }}
              />
            ))}
            <div
              style={{
                ...styles.dialKnobBase,
                transform: `rotate(${knobAngle}deg)`,
              }}
              onClick={handleKnobClick}
            >
              <div style={styles.dialKnobIndicator} />
            </div>
          </div>

          <div style={styles.speakerGrill} />

          <button
            style={{
              ...styles.actionButton,
              ...(buttonHovered || confirmed
                ? { backgroundColor: '#111111', color: '#ffffff' }
                : {}),
            }}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            onClick={handleConfirm}
          >
            CONFIRM SELECTION
          </button>
        </div>

        {/* Right Panel - Server List */}
        <div style={styles.panelList}>
          {servers.map((server, index) => {
            const isActive = activeIndex === index;
            const isFlashing = flashIndex === index;
            const isLast = index === servers.length - 1;

            let rowStyle = { ...styles.serverRowBase };
            if (isLast) rowStyle = { ...rowStyle, ...styles.serverRowLastChild };
            if (isFlashing) {
              rowStyle = { ...rowStyle, ...styles.serverRowFlash };
            } else if (isActive) {
              rowStyle = { ...rowStyle, ...styles.serverRowActive };
            }

            const textColor = isFlashing ? '#ffffff' : '#111111';

            return (
              <div
                key={server.id}
                style={rowStyle}
                onMouseEnter={() => handleRowHover(index)}
                onClick={() => handleRowClick(index)}
              >
                <div style={{ ...styles.crosshairBase, ...styles.chTL }} />
                <div style={{ ...styles.serverId, color: textColor }}>
                  {server.id}
                </div>
                <div style={styles.serverMeta}>
                  <span style={{ ...styles.latencyVal, color: textColor }}>
                    {server.latency}
                  </span>
                  <span style={{ ...styles.latencyUnit, color: textColor }}>
                    ms latency
                  </span>
                </div>
                <div style={{ ...styles.crosshairBase, ...styles.chBR }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;