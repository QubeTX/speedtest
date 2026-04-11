import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import { colors, borders, typography } from '../theme/tokens';
import type { CSSProperties, ReactNode } from 'react';

/* ─── Reusable style helpers ─── */

const ACCENT_BORDER = `4px solid ${colors.ink}`;

function sectionNumber(n: number): string {
  return String(n).padStart(2, '0');
}

/* ─── Component ─── */

export default function TechnicalReportView() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();

  const compact = isMobile || isTablet;
  const articlePad = isMobile ? '1.5rem' : isTablet ? '2.5rem' : '3.5rem';

  /* ── base styles ── */

  const pageStyle: CSSProperties = {
    minHeight: '100dvh',
    backgroundColor: colors.bgCanvas,
    color: colors.ink,
    fontFamily: typography.fontFamily,
    overflowY: 'auto',
    WebkitFontSmoothing: 'antialiased',
  };

  const articleStyle: CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: `2rem ${articlePad} 4rem`,
  };

  const headerBarStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: compact ? '3rem' : '4rem',
  };

  const sectionStyle: CSSProperties = {
    marginBottom: compact ? '3rem' : '4rem',
  };

  const sectionHeadStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    alignItems: 'baseline',
    marginBottom: '1.5rem',
  };

  const numStyle: CSSProperties = {
    fontSize: compact ? '2.2rem' : '3rem',
    fontWeight: 700,
    opacity: 0.08,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  };

  const h2Style: CSSProperties = {
    fontSize: compact ? '1.15rem' : '1.5rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
    textTransform: 'uppercase',
  };

  const pStyle: CSSProperties = {
    fontSize: '1rem',
    lineHeight: 1.8,
    color: '#333',
    margin: '0 0 1.25rem',
  };

  const pullQuoteStyle: CSSProperties = {
    borderLeft: ACCENT_BORDER,
    paddingLeft: '1.25rem',
    margin: '2rem 0',
    fontSize: compact ? '1rem' : '1.1rem',
    fontWeight: 600,
    lineHeight: 1.6,
    color: colors.ink,
    fontStyle: 'italic',
  };

  const cardStyle: CSSProperties = {
    backgroundColor: colors.paper,
    border: borders.stroke,
    borderRadius: '0',
    padding: compact ? '1.25rem' : '1.75rem',
    marginBottom: '1.5rem',
  };

  const cardLabelStyle: CSSProperties = {
    ...typography.metaLabel,
    marginBottom: '1rem',
    display: 'block',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  };

  const thStyle: CSSProperties = {
    textAlign: 'left',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontSize: '0.65rem',
    padding: '0.6rem 0.75rem',
    borderBottom: borders.strokeThin,
    whiteSpace: 'nowrap',
  };

  const tdStyle: CSSProperties = {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid rgba(17,17,17,0.08)',
    fontSize: '0.8rem',
    lineHeight: 1.5,
  };

  const dividerStyle: CSSProperties = {
    height: '1px',
    background: 'rgba(17,17,17,0.1)',
    border: 'none',
    margin: compact ? '2.5rem 0' : '3rem 0',
  };

  /* ── render helpers ── */

  function Section({ num, title, children }: { num: number; title: string; children: ReactNode }) {
    return (
      <div style={sectionStyle}>
        <div style={sectionHeadStyle}>
          <span style={numStyle}>{sectionNumber(num)}</span>
          <h2 style={h2Style}>{title}</h2>
        </div>
        {children}
      </div>
    );
  }

  function PullQuote({ children }: { children: ReactNode }) {
    return <blockquote style={pullQuoteStyle}>{children}</blockquote>;
  }

  function SpecCard({ label, children }: { label: string; children: ReactNode }) {
    return (
      <div style={cardStyle}>
        <span style={cardLabelStyle}>{label}</span>
        {children}
      </div>
    );
  }

  function TableRow({ cells, boldFirst = false }: { cells: ReactNode[]; boldFirst?: boolean }) {
    return (
      <tr>
        {cells.map((cell, i) => (
          <td
            key={i}
            style={{
              ...tdStyle,
              ...(i === 0 && boldFirst ? { fontWeight: 600, whiteSpace: 'nowrap' as const, verticalAlign: 'top' as const } : {}),
            }}
          >
            {cell}
          </td>
        ))}
      </tr>
    );
  }

  /* ─── Article ─── */

  return (
    <div style={pageStyle}>
      <article style={articleStyle}>

        {/* ── Top bar ── */}
        <div style={headerBarStyle}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: colors.ink,
              opacity: 0.5,
              padding: '0.5rem 0',
              fontFamily: typography.fontFamily,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
          >
            &larr; BACK TO TEST
          </button>
          <img
            src="https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg"
            alt="QubeTX"
            style={{ height: compact ? '14px' : '18px', opacity: 0.8 }}
          />
        </div>

        {/* ── Hero ── */}
        <header style={{ marginBottom: compact ? '3rem' : '4.5rem' }}>
          <h1 style={{
            fontSize: compact ? '2rem' : '3rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: '0 0 1rem',
          }}>
            How We Measure Your Internet
          </h1>
          <p style={{
            fontSize: compact ? '1rem' : '1.15rem',
            lineHeight: 1.6,
            color: '#555',
            maxWidth: '600px',
            margin: 0,
          }}>
            The science behind technician-grade accuracy &mdash; and why this tool exists.
          </p>
          <div style={{
            marginTop: '2rem',
            height: '3px',
            width: compact ? '60px' : '80px',
            backgroundColor: colors.ink,
          }} />
        </header>

        <hr style={dividerStyle} />

        {/* ── 01 The Problem ── */}
        <Section num={1} title="THE PROBLEM WITH SPEED TESTS">
          <p style={pStyle}>
            You click "Go," a spinner runs for ten seconds, and you get a number. 247 Mbps download.
            Sounds precise.  It isn't.
          </p>
          <p style={pStyle}>
            Most speed tests measure your connection the way a sprinter measures the first
            five meters of a race and calls it their finish time.  They connect to a single
            server, open a single connection, run a test for barely ten seconds, and report
            the result with no statistical processing.  The number you see is contaminated by
            TCP slow-start warmup, transient network bursts, and the fact that the test
            server might be three hops away or three hundred.
          </p>
          <p style={pStyle}>
            Worse, some tests are deliberately optimistic.  Reporting the 90th percentile
            instead of the median means your "speed" reflects the fastest 10% of measurements,
            not the throughput you actually experience while streaming, gaming, or on a video
            call.  It makes the number look impressive.  It just doesn't make it useful.
          </p>
          <PullQuote>
            A speed test that gives you one big number and no context is like
            a thermometer that only reads in "warm" and "cold."
          </PullQuote>
          <p style={pStyle}>
            And almost none of them test the thing that actually ruins your experience:
            what happens to your latency when the connection is under load.  Your 500 Mbps
            download means nothing if your ping spikes to 400ms the moment someone starts
            a file transfer.  That phenomenon has a name &mdash; bufferbloat &mdash; and
            we'll get to it.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 02 Dual-Provider ── */}
        <Section num={2} title="DUAL-PROVIDER CROSS-VALIDATION">
          <p style={pStyle}>
            Instead of trusting a single test server, we run two completely independent
            measurement engines back-to-back: Cloudflare's speed test infrastructure and
            M-Lab's NDT7 protocol.  Each uses a fundamentally different methodology, different
            servers, and different network paths.
          </p>
          <p style={pStyle}>
            Cloudflare's engine makes multiple HTTP requests with progressively larger payloads
            to their global edge network &mdash; the same infrastructure that serves roughly
            20% of the web.  It saturates your connection the way real-world browsing does:
            multiple requests, varying sizes, real HTTP overhead.
          </p>
          <p style={pStyle}>
            M-Lab's NDT7, backed by Google and operated by Measurement Lab, takes a different
            approach: a single persistent WebSocket connection that streams data for the full
            test duration.  This gives a conservative, single-flow view of your TCP performance
            and exposes bottlenecks that multi-connection tests mask.  It also extracts latency
            data directly from the Linux kernel's TCP stack &mdash; the most precise RTT
            measurement available in a browser.
          </p>

          <SpecCard label="PROVIDER COMPARISON">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Metric</th>
                  <th style={thStyle}>Cloudflare</th>
                  <th style={thStyle}>NDT7</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst cells={['Protocol', 'HTTPS (multi-request)', 'WebSocket over TLS']} />
                <TableRow boldFirst cells={['Connections', 'Multiple, progressive', 'Single stream']} />
                <TableRow boldFirst cells={['Bandwidth', 'Saturates fast pipes', 'Reveals TCP bottlenecks']} />
                <TableRow boldFirst cells={['Latency', 'HTTP RTT (configurable)', 'Kernel TCPInfo.MinRTT']} />
                <TableRow boldFirst cells={['Packet Loss', 'UDP via TURN (WebRTC)', 'Not measured']} />
                <TableRow boldFirst cells={['Server', 'Nearest Cloudflare PoP', 'Nearest M-Lab node']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            When both providers agree, your confidence in the result is high.  When they
            disagree, that disagreement itself is diagnostic data &mdash; and we report it.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 03 Latency ── */}
        <Section num={3} title="HOW WE MEASURE LATENCY">
          <p style={pStyle}>
            Before any bandwidth testing begins, a dedicated latency engine fires 100
            HTTP pings against Cloudflare's edge.  Not 5.  Not 20.  One hundred individual
            round-trip time measurements, each captured with the browser's
            PerformanceResourceTiming API at sub-millisecond precision.
          </p>
          <p style={pStyle}>
            The first three pings are thrown away.  They carry the overhead of DNS
            resolution, TCP handshake, and TLS negotiation &mdash; noise that has nothing
            to do with your ongoing network latency.  Once the connection is warm, the
            remaining 97 samples paint an accurate picture.
          </p>

          <SpecCard label="LATENCY OUTPUT">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Metric</th>
                  <th style={thStyle}>What It Means</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst cells={[
                  'P50 (Median)',
                  'Your typical ping.  The number half your samples fall below.  This is what you feel when browsing.',
                ]} />
                <TableRow boldFirst cells={[
                  'P95',
                  'Tail latency.  If this is high, one in twenty interactions will feel sluggish \u2014 bad for video calls.',
                ]} />
                <TableRow boldFirst cells={[
                  'P99',
                  'Worst-case latency.  Critical for competitive gaming, where a single spike means a missed shot.',
                ]} />
                <TableRow boldFirst cells={[
                  'Jitter (RFC 3550)',
                  'How much your latency varies from ping to ping.  Low jitter means smooth voice and video.  Calculated using the same algorithm as VoIP and video conferencing systems.',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            In everyday terms: your P50 is what you feel when you click a link.  Your P95
            is the occasional stutter on a Zoom call.  Your P99 is the rubber-banding moment
            in an online game.  Jitter is why your colleague's voice sometimes sounds like a
            broken robot.  We measure all of them because a single "ping" number hides more
            than it reveals.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 04 Speed ── */}
        <Section num={4} title="HOW WE MEASURE SPEED">
          <p style={pStyle}>
            Raw bandwidth samples from both providers pass through a three-stage accuracy
            pipeline.  Think of it as the difference between dumping a bucket of data on a
            scale versus carefully measuring, cleaning, and weighing it.
          </p>

          <SpecCard label="STAGE 1 // SLOW-START DISCARD">
            <p style={{ ...pStyle, margin: '0 0 0.5rem' }}>
              Every TCP connection begins with a "slow start" phase where the protocol
              cautiously ramps up speed.  During those first moments, throughput is
              artificially low &mdash; it doesn't represent your actual connection speed.
              We discard the first 30% of samples to eliminate this warmup contamination.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 2 // IQR OUTLIER FILTERING">
            <p style={{ ...pStyle, margin: '0 0 0.5rem' }}>
              Statistical outliers are removed using the Interquartile Range method.
              Transient congestion dips, JavaScript garbage collection artifacts, and
              freak network bursts are identified and stripped.  What remains are samples
              that represent your sustained, real-world throughput.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 3 // MODIFIED TRIMEAN">
            <p style={{ ...pStyle, margin: '0 0 0.75rem' }}>
              The final speed value uses the modified trimean, the same formula Ookla
              (Speedtest.net's parent company) uses in their Speed Score methodology:
            </p>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: colors.bgCanvas,
              padding: '0.75rem 1rem',
              borderRadius: '0',
              border: '1px solid rgba(17,17,17,0.1)',
              marginBottom: '0.75rem',
              letterSpacing: '0.02em',
            }}>
              {'Result = (P10 + 8 \u00D7 P50 + P90) / 10'}
            </div>
            <p style={{ ...pStyle, margin: 0 }}>
              The median gets 80% of the weight.  The 10th percentile pulls the number
              down slightly to account for bad moments.  The 90th percentile nudges it up
              for burst capability.  The result is a number that represents what you
              actually experience &mdash; not the best case, not the worst case, but the
              typical case with a slight nod to reality.
            </p>
          </SpecCard>

          <PullQuote>
            We throw away the warmup, remove the flukes, and calculate
            what you actually experience.
          </PullQuote>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 05 Bufferbloat ── */}
        <Section num={5} title="BUFFERBLOAT: THE HIDDEN PROBLEM">
          <p style={pStyle}>
            Here's a scenario most people have lived through: you're on a video call, and
            someone in the house starts downloading a large file.  Suddenly your call turns
            into a slideshow.  Your ISP promised you 300 Mbps, and you're getting 300 Mbps.
            So why is everything terrible?
          </p>
          <p style={pStyle}>
            The answer is bufferbloat.  When your router receives more data than it can
            forward, it stuffs the excess into a buffer &mdash; a queue.  If that buffer is
            oversized (and most consumer routers ship with absurdly large buffers), packets
            sit in line for hundreds of milliseconds before being delivered.  Your bandwidth
            is fine.  Your latency is catastrophic.
          </p>
          <p style={pStyle}>
            We detect bufferbloat by measuring your latency twice: once with the connection
            idle (unloaded), and once while actively pushing bandwidth (loaded).  The ratio
            between the two tells the story.
          </p>

          <SpecCard label="BUFFERBLOAT GRADING">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>Ratio</th>
                  <th style={thStyle}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst={false} cells={[
                  <span key="a" style={{ fontWeight: 700, fontSize: '1rem' }}>A</span>,
                  <span key="ar" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 1.5x'}</span>,
                  'Excellent.  Minimal buffering.  Likely running smart queue management.',
                ]} />
                <TableRow boldFirst={false} cells={[
                  <span key="b" style={{ fontWeight: 700, fontSize: '1rem' }}>B</span>,
                  <span key="br" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'1.5x \u2013 3x'}</span>,
                  'Good.  Some buffering under load, acceptable for most uses.',
                ]} />
                <TableRow boldFirst={false} cells={[
                  <span key="c" style={{ fontWeight: 700, fontSize: '1rem' }}>C</span>,
                  <span key="cr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'3x \u2013 5x'}</span>,
                  'Fair.  Noticeable under load.  VoIP and video calls will occasionally degrade.',
                ]} />
                <TableRow boldFirst={false} cells={[
                  <span key="d" style={{ fontWeight: 700, fontSize: '1rem' }}>D</span>,
                  <span key="dr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'5x \u2013 10x'}</span>,
                  'Poor.  Significant bufferbloat.  Real-time applications suffer noticeably.',
                ]} />
                <TableRow boldFirst={false} cells={[
                  <span key="f" style={{ fontWeight: 700, fontSize: '1rem' }}>F</span>,
                  <span key="fr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'> 10x'}</span>,
                  'Critical.  Severe bufferbloat.  Your connection is fast on paper, miserable in practice.',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            Most speed tests don't measure this at all.  They test bandwidth in isolation,
            declare your connection fast, and leave you wondering why Netflix buffers
            every time someone joins a Zoom call.  We test it because it is, in practice,
            the single most common cause of poor internet quality that goes undiagnosed.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 06 Stability ── */}
        <Section num={6} title="CONNECTION STABILITY">
          <p style={pStyle}>
            A connection that averages 500 Mbps sounds great.  But if it swings between 50
            and 900 Mbps every few seconds, your experience will be terrible.  Streaming
            buffers.  Downloads stall and resume.  Games rubberband.  The average means nothing
            if the variance is high.
          </p>
          <p style={pStyle}>
            We quantify stability using the coefficient of variation &mdash; the ratio of
            standard deviation to mean, expressed as a simple rating from "Excellent" to
            "Poor." A CV below 0.10 means rock-solid throughput.  Above 0.40 means your
            connection is essentially unreliable regardless of its peak speed.
          </p>

          <PullQuote>
            500 Mbps that drops to 50 Mbps every few seconds is worse
            than a steady 200 Mbps.
          </PullQuote>

          <SpecCard label="STABILITY RATINGS">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>CV</th>
                  <th style={thStyle}>Rating</th>
                  <th style={thStyle}>What It Feels Like</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst cells={['< 0.10', 'Excellent', 'Rock steady.  Fiber-like consistency.']} />
                <TableRow boldFirst cells={['0.10 \u2013 0.15', 'Good', 'Minor fluctuations.  Stable for all uses.']} />
                <TableRow boldFirst cells={['0.15 \u2013 0.20', 'Fair', 'Noticeable variation.  Shared medium or mild congestion.']} />
                <TableRow boldFirst cells={['0.20 \u2013 0.40', 'Variable', 'Significant swings.  Wireless interference, peak-hour congestion.']} />
                <TableRow boldFirst cells={['> 0.40', 'Poor', 'Highly unstable.  Packet loss, severe congestion, or throttling.']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            This metric is computed separately for download and upload.  A connection that
            is stable on download but variable on upload often points to wireless
            interference or asymmetric QoS policies by the ISP.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 07 Provider Divergence ── */}
        <Section num={7} title="PROVIDER DIVERGENCE">
          <p style={pStyle}>
            When Cloudflare and NDT7 report similar results, that's straightforward &mdash;
            your connection is performing consistently regardless of how it's measured.  But
            when they disagree by more than 30%, that disagreement itself is a diagnosis.
          </p>
          <p style={pStyle}>
            Cloudflare's multi-connection approach mimics how browsers load web pages:
            many simultaneous requests, varying sizes, real HTTP overhead.  NDT7's single
            WebSocket stream behaves more like a large file download or a VPN tunnel.
            If your ISP throttles certain traffic patterns, shapes single-stream flows
            differently than multi-stream, or applies QoS policies based on protocol
            detection, the two providers will give different results.
          </p>

          <SpecCard label="COMMON CAUSES OF DIVERGENCE">
            <table style={tableStyle}>
              <tbody>
                <TableRow boldFirst cells={['ISP Throttling', 'Different shaping rules for single-stream vs. multi-stream traffic']} />
                <TableRow boldFirst cells={['QoS Policies', 'Network equipment prioritizing certain traffic classes over others']} />
                <TableRow boldFirst cells={['Routing Asymmetry', 'Cloudflare edge and M-Lab server using different network paths']} />
                <TableRow boldFirst cells={['TCP Optimization', 'Middleboxes optimizing for specific connection patterns']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            A technician can use per-provider results to narrow down the issue.  If
            Cloudflare consistently outperforms NDT7, single-stream throttling is likely.
            If NDT7 outperforms Cloudflare, the network may have poor HTTP handling or
            CDN routing issues.  This is diagnostic information that no single-provider
            test can provide.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 08 DNS ── */}
        <Section num={8} title="DNS DIAGNOSTICS">
          <p style={pStyle}>
            When you type a URL, the first thing your browser does is look up the domain
            name &mdash; converting "google.com" into an IP address.  If your DNS resolver
            is slow, every single page load starts with a penalty before a single byte of
            content is transferred.
          </p>
          <p style={pStyle}>
            We probe 12 major domains in parallel, timing four distinct phases of each
            connection using the Performance Resource Timing API:
          </p>

          <SpecCard label="DNS TIMING BREAKDOWN">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Phase</th>
                  <th style={thStyle}>What It Measures</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst cells={['DNS', 'How long your resolver takes to translate the domain name to an IP address']} />
                <TableRow boldFirst cells={['TCP', 'The time to establish a connection to the remote server']} />
                <TableRow boldFirst cells={['TLS', 'The overhead of negotiating encryption (HTTPS handshake)']} />
                <TableRow boldFirst cells={['TTFB', 'Time to first byte \u2014 how quickly the server begins responding']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            The 12 target domains span the major content providers and CDNs that account
            for the bulk of everyday internet traffic: Google, Cloudflare, Apple, Microsoft,
            Amazon, Netflix, GitHub, Wikipedia, Facebook, Twitter, YouTube, and Reddit.
            If any of them are slow or unreachable, you'll know about it &mdash; and you'll
            know whether the bottleneck is DNS resolution, TCP connectivity, TLS negotiation,
            or server response.
          </p>
          <p style={pStyle}>
            This runs in the background alongside the speed test.  It doesn't slow your
            test down, but it provides context that other tools completely ignore.  A fast
            connection with a slow DNS resolver will feel slow no matter what your bandwidth
            numbers say.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 09 Network Identity ── */}
        <Section num={9} title="YOUR NETWORK IDENTITY">
          <p style={pStyle}>
            When you run a speed test, you&rsquo;re not just measuring bandwidth &mdash;
            you&rsquo;re also revealing where your data travels.  We collect and display
            your network identity so you can see exactly what&rsquo;s happening behind
            the scenes.
          </p>
          <p style={pStyle}>
            <strong>ISP &amp; ASN</strong> &mdash; Your Internet Service Provider and their
            Autonomous System Number.  Every ISP has a unique ASN that identifies their
            network in the global routing system.  Knowing which AS handles your traffic
            helps diagnose routing-specific issues.
          </p>
          <p style={pStyle}>
            <strong>Edge Server</strong> &mdash; The Cloudflare data center handling your
            test, identified by its IATA airport code (e.g., DFW for Dallas-Fort Worth).
            The closer the edge server, the lower your baseline latency.  If you see a
            distant server, your ISP&rsquo;s routing may be suboptimal.
          </p>
          <p style={pStyle}>
            <strong>IPv4 vs IPv6</strong> &mdash; Which internet protocol your connection
            uses.  IPv6 is the modern standard with a vastly larger address space.  Some
            ISPs route IPv4 and IPv6 traffic differently, which can affect performance.
          </p>
          <p style={pStyle}>
            All of this metadata is fetched from Cloudflare&rsquo;s edge response headers
            in parallel with your latency test &mdash; it adds zero time to the measurement.
            Your data stays in your browser; nothing is stored or transmitted.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 10 Per-Direction Jitter ── */}
        <Section num={10} title="PER-DIRECTION JITTER">
          <p style={pStyle}>
            Most speed tests report a single jitter number.  We break it down into three:
            idle jitter, download jitter, and upload jitter.  Why?  Because they tell
            very different stories about your connection.
          </p>
          <p style={pStyle}>
            <strong>Idle jitter</strong> is your baseline &mdash; how much your latency
            varies when nothing else is happening.  <strong>Download jitter</strong> measures
            variability while your connection is under download load, revealing how your
            router&rsquo;s buffers behave when saturated.  <strong>Upload jitter</strong> is
            critical for video calls &mdash; it directly determines the smoothness of your
            outgoing audio and video.
          </p>
          <p style={pStyle}>
            A connection with low idle jitter but high upload jitter will feel fine for
            browsing but produce choppy Zoom calls.  The breakdown helps pinpoint exactly
            where the problem lives.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 11 Confidence Intervals ── */}
        <Section num={11} title="CONFIDENCE INTERVALS">
          <p style={pStyle}>
            Your download speed is 45.2 Mbps, give or take about 3 Mbps.  That &ldquo;give
            or take&rdquo; is the confidence interval &mdash; a statistically rigorous way
            of saying how certain we are about the result.
          </p>
          <p style={pStyle}>
            We compute it using <strong>bootstrap resampling</strong>: we take your bandwidth
            measurements, randomly resample them with replacement 1,000 times, and compute
            our modified trimean on each resample.  The middle 95% of those 1,000 results
            forms the confidence interval.  A narrow range means your connection was stable
            and our measurement is precise.  A wide range means the connection was variable
            and you should interpret the result with appropriate uncertainty.
          </p>
          <p style={pStyle}>
            This is the same technique used in clinical trials and scientific research when
            you can&rsquo;t assume your data follows a neat bell curve &mdash; which internet
            bandwidth measurements rarely do.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 12 Smart Provider Weighting ── */}
        <Section num={12} title="SMART PROVIDER WEIGHTING">
          <p style={pStyle}>
            When combining results from Cloudflare and NDT7, we don&rsquo;t use a fixed
            50/50 or 60/40 split.  Instead, we use <strong>inverse-variance weighting</strong>
            &mdash; whichever test engine gives more consistent results automatically gets
            more influence on the final number.
          </p>
          <p style={pStyle}>
            If Cloudflare&rsquo;s measurements were very steady but NDT7&rsquo;s bounced
            around, Cloudflare&rsquo;s result counts for more &mdash; and vice versa.  This
            is the statistically optimal way to combine two independent measurements of the
            same quantity, minimizing the variance of the combined estimate.
          </p>
          <p style={pStyle}>
            We also run a <strong>winsorized validation</strong>: a second, independent
            calculation that caps outliers at the 5th/95th percentile instead of removing
            them entirely.  If the two methods disagree significantly, we average them for
            extra safety.  Belt and suspenders.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 13 Comparison ── */}
        <Section num={13} title="WHY CHOOSE THIS OVER...">
          <p style={pStyle}>
            We built this tool because the existing options leave gaps.  Here's an honest
            comparison &mdash; not to disparage other tools, but to explain what's different.
          </p>

          <SpecCard label="COMPARISON MATRIX">
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Feature</th>
                    <th style={thStyle}>QubeTX</th>
                    <th style={thStyle}>Speedtest.net</th>
                    <th style={thStyle}>Fast.com</th>
                    <th style={thStyle}>Google</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow boldFirst cells={['Providers', <strong key="v">2 (cross-validated)</strong>, '1', '1 (Netflix)', '1']} />
                  <TableRow boldFirst cells={['Stat Method', <strong key="v">Modified trimean</strong>, '90th percentile', 'Undisclosed', 'Undisclosed']} />
                  <TableRow boldFirst cells={['Slow-Start Discard', <strong key="v">Yes (30%)</strong>, 'Partial', 'Unknown', 'Unknown']} />
                  <TableRow boldFirst cells={['Outlier Filtering', <strong key="v">IQR fence</strong>, 'Unknown', 'Unknown', 'No']} />
                  <TableRow boldFirst cells={['Bufferbloat', <strong key="v">A-F grade</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Stability (CV)', <strong key="v">Yes</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Latency Percentiles', <strong key="v">P50/P95/P99</strong>, 'Median only', 'No', 'No']} />
                  <TableRow boldFirst cells={['RFC 3550 Jitter', <strong key="v">Yes</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['DNS Diagnostics', <strong key="v">12 domains</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Provider Divergence', <strong key="v">Yes</strong>, 'N/A', 'N/A', 'N/A']} />
                  <TableRow boldFirst cells={['Confidence Intervals', <strong key="v">95% CI (bootstrap)</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Per-Direction Jitter', <strong key="v">Idle/DL/UL</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Network Identity', <strong key="v">ISP/ASN/IP/Geo</strong>, 'Server only', 'No', 'No']} />
                  <TableRow boldFirst cells={['Dynamic Weighting', <strong key="v">Inverse-variance</strong>, 'N/A', 'N/A', 'N/A']} />
                  <TableRow boldFirst cells={['Open Methodology', <strong key="v">Documented</strong>, 'Partial', 'No', 'No']} />
                </tbody>
              </table>
            </div>
          </SpecCard>

          <p style={pStyle}>
            Speedtest.net has been the default for two decades, and it does what it does
            well &mdash; but its single-provider, 90th-percentile reporting produces
            optimistic results that may not reflect your actual experience.  Fast.com is
            Netflix's tool, designed primarily to check if your ISP is throttling Netflix
            traffic, and its methodology is undocumented.  Google's built-in speed test is
            basic: a quick single-server check with no advanced metrics.
          </p>
          <p style={pStyle}>
            None of them test bufferbloat, measure connection stability, provide latency
            percentiles, or cross-validate with multiple providers.  These aren't niche
            features &mdash; they're the metrics that explain why a "fast" connection
            still feels slow.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 10 Standards ── */}
        <Section num={10} title="BUILT ON STANDARDS">
          <p style={pStyle}>
            We don't invent our own math.  Every statistical method and measurement
            technique used in this tool is grounded in published standards, peer-reviewed
            research, or industry-established methodology.
          </p>

          <SpecCard label="STANDARDS AND REFERENCES">
            <table style={tableStyle}>
              <tbody>
                <TableRow boldFirst cells={[
                  'RFC 3550',
                  'RTP jitter calculation (Section 6.4.1) \u2014 the standard used by VoIP and video conferencing',
                ]} />
                <TableRow boldFirst cells={[
                  'RFC 6349',
                  'Framework for TCP throughput testing methodology',
                ]} />
                <TableRow boldFirst cells={[
                  'RFC 5681',
                  'TCP congestion control \u2014 informs our slow-start discard strategy',
                ]} />
                <TableRow boldFirst cells={[
                  'Ookla Methodology',
                  'Modified trimean (P10:P50:P90 at 1:8:1 weighting) for bandwidth scoring',
                ]} />
                <TableRow boldFirst cells={[
                  'M-Lab NDT Protocol',
                  'Open-source single-stream TCP measurement, operated by Measurement Lab',
                ]} />
                <TableRow boldFirst cells={[
                  'PerformanceResourceTiming',
                  'W3C standard for high-precision browser timing extraction',
                ]} />
                <TableRow boldFirst cells={[
                  'Bufferbloat.net',
                  'Community-established grading methodology for buffer-induced latency',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            The full technical methodology, including code-level implementation details,
            algorithm specifications, and configuration rationale, is published in our{' '}
            <a
              href="https://github.com/QubeTX/speedtest/blob/main/ACCURACY.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: colors.ink,
                fontWeight: 600,
                textDecorationThickness: '2px',
                textUnderlineOffset: '3px',
              }}
            >
              ACCURACY.md
            </a>{' '}
            technical documentation.  Nothing is hidden.  Every decision is explained.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── Footer ── */}
        <footer style={{
          textAlign: 'center',
          padding: '2rem 0 1rem',
        }}>
          <img
            src="https://shaughv.s3.us-east-1.amazonaws.com/brandmark/QUBETX/QubeTX-Logo.svg"
            alt="QubeTX"
            style={{ height: '16px', opacity: 0.4, marginBottom: '1rem' }}
          />
          <p style={{
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            color: 'rgba(17,17,17,0.35)',
            margin: 0,
            fontWeight: 500,
          }}>
            BUILT BY QUBETX &middot; MEASUREMENT YOU CAN TRUST
          </p>
        </footer>

      </article>
    </div>
  );
}
