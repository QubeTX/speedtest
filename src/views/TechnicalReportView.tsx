import { useNavigate } from 'react-router-dom';
import { useIsWide } from '../hooks/useResponsive';
import { colors, borders, typography, fontFamilies } from '../theme/tokens';
import type { CSSProperties, ReactNode } from 'react';

/* ─── Reusable style helpers ─── */

const ACCENT_BORDER = `4px solid ${colors.ink}`;

function sectionNumber(n: number): string {
  return String(n).padStart(2, '0');
}

/* ─── Component ─── */

export default function TechnicalReportView() {
  const navigate = useNavigate();
  const isWide = useIsWide();

  const compact = !isWide;
  const articlePad = 'clamp(1.5rem, 5vw, 3.5rem)';

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

  /* ── TT;DR lead block — Plex Mono micro-label + Makira body, tinted panel
   *    with an ink accent edge. Sits on top of the full technical detail in
   *    every section; it summarizes, it never replaces. ── */

  const ttdrStyle: CSSProperties = {
    backgroundColor: colors.bgDevice,
    borderLeft: ACCENT_BORDER,
    padding: compact ? '1rem 1.15rem' : '1.15rem 1.4rem',
    margin: '0 0 1.75rem',
  };

  const ttdrLabelStyle: CSSProperties = {
    ...typography.metaLabel,
    display: 'block',
    marginBottom: '0.5rem',
    opacity: 0.55,
  };

  const ttdrBodyStyle: CSSProperties = {
    fontFamily: fontFamilies.display,
    fontSize: compact ? '0.98rem' : '1.08rem',
    lineHeight: 1.55,
    fontWeight: 500,
    color: colors.ink,
    margin: 0,
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

  const formulaStyle: CSSProperties = {
    fontFamily: fontFamilies.instrument,
    fontSize: '0.8rem',
    fontWeight: 600,
    backgroundColor: colors.bgCanvas,
    padding: '0.85rem 1rem',
    borderRadius: '0',
    border: '1px solid rgba(17,17,17,0.12)',
    margin: '0 0 0.9rem',
    letterSpacing: '0.01em',
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
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

  function TtDr({ children }: { children: ReactNode }) {
    return (
      <div style={ttdrStyle}>
        <span style={ttdrLabelStyle}>TT;DR</span>
        <p style={ttdrBodyStyle}>{children}</p>
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

  function Formula({ children }: { children: ReactNode }) {
    return <div style={formulaStyle}>{children}</div>;
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
            Every result is stamped with the exact version of the math that produced it:
            SpeedQX Methodology 4.0.
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
          <TtDr>
            One number from one nearby server, measured for a few seconds, is easy to make
            look good and hard to trust. We built this because the speed that matters is the
            one you actually live with &mdash; including what happens to your connection the
            moment it gets busy.
          </TtDr>
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
          <p style={pStyle}>
            Everything below is our answer to those failures.  It is written down, versioned,
            and identical across our website, our iOS app, and our command-line tool, so any
            number you see can be traced back to the exact algorithm that produced it.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 02 Seven Sources ── */}
        <Section num={2} title="SEVEN INDEPENDENT SOURCES">
          <TtDr>
            Instead of trusting a single company's server, we run a whole panel of independent
            speed tests and compare them.  Each one is good at something different, and we're
            honest about which ones a given device can and can't run.
          </TtDr>
          <p style={pStyle}>
            A single test server can be having a bad day, sit behind a congested peering link,
            or be optimized in ways that flatter the result.  So we don't rely on one.  The
            methodology defines a registry of eight measurement sources.  Seven of them run
            directly in your browser; the eighth (Apple's networkQuality) can only run in our
            command-line tool, because browsers block it for security reasons.
          </p>

          <SpecCard label="MEASUREMENT SOURCE REGISTRY">
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>What It Is</th>
                    <th style={thStyle}>Best At</th>
                    <th style={thStyle}>In Browser?</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow boldFirst cells={[
                    'Cloudflare',
                    'HTTPS request ladder up to 250 MB across the global edge network',
                    'Saturating fast pipes; also loaded latency and packet loss',
                    'Yes',
                  ]} />
                  <TableRow boldFirst cells={[
                    'M-Lab NDT7',
                    'A single long-lived WebSocket stream; reads the server’s kernel TCP metrics',
                    'Conservative single-flow view + the most precise round-trip time',
                    'Yes',
                  ]} />
                  <TableRow boldFirst cells={[
                    'M-Lab MSAK',
                    'Two parallel WebSocket streams (Measurement Lab’s newer test)',
                    'Multi-stream throughput with kernel-level RTT',
                    'Yes',
                  ]} />
                  <TableRow boldFirst cells={[
                    'LibreSpeed',
                    'HTTPS against a rotation of CORS-verified community backends',
                    'An open-source, vendor-neutral cross-check',
                    'Yes',
                  ]} />
                  <TableRow boldFirst cells={[
                    'fast.com',
                    'HTTPS to Netflix’s own delivery nodes (token via a relay on web/app)',
                    'Whether Netflix-style traffic is throttled (labeled an estimate)',
                    'Yes*',
                  ]} />
                  <TableRow boldFirst cells={[
                    'CacheFly',
                    'HTTPS range requests (1/10/100 MB test files)',
                    'Download from an anycast CDN',
                    'Yes (download only)',
                  ]} />
                  <TableRow boldFirst cells={[
                    'Vultr',
                    'HTTPS range requests, nearest of 8 datacenters chosen by min-RTT',
                    'Download from a cloud host',
                    'Yes (download only)',
                  ]} />
                  <TableRow boldFirst cells={[
                    'Apple networkQuality',
                    'Apple’s four parallel responsiveness endpoints',
                    'Apple’s own responsiveness measurement',
                    'CLI only',
                  ]} />
                </tbody>
              </table>
            </div>
          </SpecCard>

          <p style={pStyle}>
            <strong>*</strong> On the web and in the app, fast.com is labeled an <em>estimate</em>
            &mdash; its node selection is based on a relay IP, not your own &mdash; and it hides
            itself on failure rather than reporting a degraded number.
          </p>

          <p style={pStyle}>
            Not every source can fill a gigabit pipe equally well.  A single-stream test reads
            low under cross-traffic <em>by design</em>, and a download-only CDN can't speak to
            your upload.  So each source carries a published <strong>capability prior</strong>{' '}
            that we use later when we combine them (&sect;6).  These priors are stated in the
            open, never applied silently: Cloudflare, fast.com, and Apple at 1.00; LibreSpeed,
            CacheFly, and Vultr at 0.95; MSAK at 0.85; single-stream NDT7 at 0.70.
          </p>

          <PullQuote>
            The spec defines the full panel.  Each platform contributes what it can run &mdash;
            and says so, out loud, for the rest.
          </PullQuote>

          <p style={pStyle}>
            Honesty about availability is a feature.  A source your device can't run appears in
            the results <strong>greyed out and labeled unavailable</strong> &mdash; never
            silently dropped.  A source that tries and fails is marked <strong>failed</strong>,
            and the merge simply continues with the others.  We never fabricate a number to
            fill an empty slot.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 03 FAST vs DEEP ── */}
        <Section num={3} title="FAST TEST vs DEEP TEST">
          <TtDr>
            You can run a quick check or a thorough one.  The quick check is smart enough to
            stop the instant it's genuinely sure of the answer &mdash; without the statistical
            sleight-of-hand that makes "just stop when it looks stable" quietly lie to you.
          </TtDr>
          <p style={pStyle}>
            The deck offers two modes.  <strong>FAST</strong> (the play button) runs the three
            strongest sources &mdash; Cloudflare, M-Lab NDT7, and M-Lab MSAK &mdash; typically
            finishing in about a minute: each source stops the moment it is statistically
            confident, and the confidence rule is deliberately conservative, so it usually
            runs to its cap rather than cutting corners.  <strong>DEEP TEST</strong> (the spec's FULL mode, and the
            default for our command-line tool) runs every source your platform can reach, for
            fixed durations, and never stops early.
          </p>
          <p style={pStyle}>
            Early stopping sounds trivial &mdash; "watch the confidence interval and stop when
            it's tight enough" &mdash; but doing it that way is statistically invalid.  Peeking
            at your data over and over and stopping the moment it looks good is a well-known
            way to fool yourself: the real coverage of your interval ends up far below the 95%
            you claim.  This is the same optional-stopping trap that plagues badly run clinical
            trials.
          </p>
          <p style={pStyle}>
            FAST mode avoids it with an <strong>anytime-valid confidence sequence</strong>
            (an empirical-Bernstein type).  Unlike an ordinary confidence interval, a
            confidence sequence is valid at <em>every</em> sample size simultaneously &mdash;
            so you can watch it continuously and stop whenever you like with <em>no</em>{' '}
            peeking penalty.
          </p>

          <SpecCard label="FAST-MODE STOP RULE (PER SOURCE)">
            <Formula>{`X_i = sample_i / U,   U = 2 x fastest sample so far
muHat_i = (0.5 + sum_{j<i} X_j) / i      (prior samples only)
stop when  CS half-width  <=  max( 5% x estimate , 2 Mbps )`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              The running mean inside the variance accumulator is <strong>strictly
              predictable</strong> &mdash; it uses only samples seen <em>before</em> the current
              one, plus a 0.5 prior.  The tempting "inclusive" form that also folds in the
              current sample is anti-conservative and voids the anytime-validity guarantee
              (it ran about 2.6% too optimistic; pinned out on 2026-07-06).
            </p>
          </SpecCard>

          <p style={pStyle}>
            Two safety rails keep FAST honest.  There is a <strong>hard cap of 25 seconds per
            source</strong>; a source that hasn't converged simply reports what it measured.
            And aggressiveness is gated on measured round-trip time, never on early throughput
            guesses: on paths with a minimum RTT above 50 ms, early termination is known to be
            unsafe, so those runs use the full duration.  DEEP TEST never early-terminates at all.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 04 Latency ── */}
        <Section num={4} title="HOW WE MEASURE LATENCY">
          <TtDr>
            Ping is how long a tiny message takes to reach the internet and come back.  We send
            a rapid burst of them, throw away the warmup, and headline the fastest honest
            round-trip &mdash; the true floor of your connection &mdash; with the full range one
            tap away.
          </TtDr>
          <p style={pStyle}>
            Before any bandwidth testing begins, a dedicated latency engine fires a dense burst
            of HTTP pings against Cloudflare's edge.  Not five.  Not twenty.  The count scales
            with your chosen test duration &mdash; from 50 samples on a short test up to 200 on
            a long one (a standard 30-second test lands at 99) &mdash; each captured with the
            browser's PerformanceResourceTiming API at sub-millisecond precision.  In the
            command-line tool, the same measurement uses a monotonic clock.
          </p>

          <SpecCard label="PROBE ENGINE">
            <Formula>{`endpoint:  speed.cloudflare.com/__down?bytes=0   (cache-busted per probe)
count:     clamp( 50 , round(durationSeconds x 3.3) , 200 )
warmup:    first 3 probes discarded (DNS + TCP + TLS setup)
interval:  50 ms between probes; paused while the tab is hidden
timing:    responseStart - requestStart when trustworthy, else wall-clock`}</Formula>
          </SpecCard>

          <p style={pStyle}>
            The first three pings are thrown away.  They carry the overhead of DNS resolution,
            TCP handshake, and TLS negotiation &mdash; noise that has nothing to do with your
            ongoing network latency.  We also pause the engine whenever the tab is hidden,
            because browsers throttle background tabs and would otherwise inflate your ping.
          </p>
          <p style={pStyle}>
            On top of the browser timing, the M-Lab sources report <strong>TCPInfo.MinRTT</strong>
            &mdash; the minimum round-trip time straight from the server's Linux kernel TCP
            stack, the most precise RTT figure obtainable.  We cross-check our probe engine
            against it.
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
                  'Min-RTT (headline)',
                  'The fastest honest round-trip across the probe engine and the kernel MinRTT values — the physical floor of the path. This is your headline ping.',
                ]} />
                <TableRow boldFirst cells={[
                  'P50 (Median)',
                  'Your typical ping.  The number half your samples fall below.  This is what you feel when browsing.',
                ]} />
                <TableRow boldFirst cells={[
                  'P95',
                  'Tail latency.  If this is high, one in twenty interactions will feel sluggish — bad for video calls.',
                ]} />
                <TableRow boldFirst cells={[
                  'P99',
                  'Worst-case latency.  Critical for competitive gaming, where a single spike means a missed shot.',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            The headline ping is the <strong>minimum</strong> round-trip time, not the average
            &mdash; the average is polluted by every transient hiccup, but the minimum is the
            genuine floor of your path.  The percentile ladder (P50, P75, P95, P99, mean, max)
            sits one tap away in the drill-down.  When we assemble the full latency stats block,
            we blend the sources' RTTs with Cloudflare at 0.4 and NDT7 at 0.6, because NDT7's
            kernel-level timing is more trustworthy.
          </p>
          <p style={pStyle}>
            In everyday terms: your min-RTT is the best your line can do; your P50 is what you
            feel when you click a link; your P95 is the occasional stutter on a call; your P99
            is the rubber-banding moment in a game.  A single "ping" number hides all of that.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 05 Speed ── */}
        <Section num={5} title="HOW WE MEASURE SPEED">
          <TtDr>
            Raw speed readings are messy: they start slow, they spike, they wobble.  For each
            source we wait for the connection to settle, drop the flukes, and report the speed
            you'd genuinely feel &mdash; plus an honest margin of error around it.
          </TtDr>
          <p style={pStyle}>
            Every source runs the same robust pipeline, independently, in each direction.
            Think of it as the difference between dumping a bucket of data on a scale versus
            carefully measuring, cleaning, and weighing it.
          </p>

          <SpecCard label="STAGE 1 // DENSE SAMPLING">
            <p style={{ ...pStyle, margin: '0 0 0.5rem' }}>
              Throughput is read on 250&ndash;500 ms ticks.  HTTP sources size each request to
              carry roughly two seconds of transfer at the last measured rate; WebSocket uploads
              grow their frames by the reference 16&times;-bytes-sent rule.  The goal is a thick,
              evenly spaced stream of samples rather than a couple of coarse readings.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 2 // PLATEAU WARM-UP DETECTION">
            <p style={{ ...pStyle, margin: '0 0 0.75rem' }}>
              Every TCP connection begins in "slow start," ramping up cautiously, so early
              samples run artificially low.  Rather than blindly discard a fixed 30% (the old
              v2/v3 approach), we <strong>detect</strong> where your connection actually reaches
              steady state:
            </p>
            <Formula>{`steady state = first index t where 3 consecutive samples each sit
               within +/- 10% of median( samples[t .. end] )
cut clamped to [ 10% , 40% ] of the series; earlier samples discarded`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              Fast connections that plateau early keep more of their data; slow-ramping ones
              discard more.  The cut is bounded so a noisy series can never throw everything away.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 3 // IQR OUTLIER FILTERING">
            <p style={{ ...pStyle, margin: '0 0 0.5rem' }}>
              Statistical outliers are removed with Interquartile-Range fences (k = 1.5, applied
              once at least four samples survive).  Transient congestion dips, JavaScript
              garbage-collection artifacts, and freak bursts are stripped.  For uploads only, we
              first keep the fastest 50% of post-warm-up samples &mdash; the industry-standard
              compensation for sender-side buffering artifacts &mdash; and then apply the fence.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 4 // MODIFIED TRIMEAN">
            <p style={{ ...pStyle, margin: '0 0 0.75rem' }}>
              The location estimate uses the modified trimean &mdash; the same statistic Ookla
              (Speedtest.net's parent) uses in its Speed Score.  A deliberate, citable choice:
            </p>
            <Formula>{`Result = ( P10 + 8 x P50 + P90 ) / 10`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              The median gets 80% of the weight; P10 pulls it down slightly for bad moments and
              P90 nudges it up for burst capability.  We then compute a <strong>Hodges&ndash;Lehmann</strong>{' '}
              estimator on the same cleaned samples as a cross-check; if it disagrees with the
              trimean by more than 15%, an internal instability flag is raised on that source.
            </p>
          </SpecCard>

          <SpecCard label="STAGE 5 // BLOCK BOOTSTRAP + BCa">
            <p style={{ ...pStyle, margin: '0 0 0.75rem' }}>
              To quantify how sure we are, we resample.  But throughput samples are{' '}
              <strong> autocorrelated</strong> &mdash; consecutive readings move together &mdash;
              so ordinary "pick individual samples at random" bootstrapping badly understates the
              real variance.  Instead we use a <strong>circular block bootstrap</strong>, which
              resamples whole contiguous blocks so the autocorrelation is preserved:
            </p>
            <Formula>{`block length  l = max( 2 , round( n^(1/3) ) )
B = 2000 circular-block resamples of the trimean
BCa (bias-corrected, accelerated) 95% interval`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              A deterministic PCG32 random stream makes every interval exactly reproducible.  The
              bootstrap variance of the trimean becomes each source's variance when we combine
              them in the next section.
            </p>
          </SpecCard>

          <PullQuote>
            We wait for the connection to settle, remove the flukes, weight toward what you
            actually experience, and attach an honest error bar.
          </PullQuote>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 06 Capacity vs Consensus ── */}
        <Section num={6} title="CAPACITY vs CONSENSUS">
          <TtDr>
            Your speed answers two fair questions: how fast <em>can</em> this line go, and what
            did <em>every</em> test agree on.  We report both &mdash; a headline for the real
            ceiling and a cautious average &mdash; instead of pretending they're the same number.
          </TtDr>
          <p style={pStyle}>
            Once each source has produced a cleaned estimate and an error bar, we combine them.
            A source qualifies for the merge only if it collected at least <strong>four</strong>{' '}
            cleaned samples in that direction; anything short is recorded in the results as an
            exclusion, never dropped silently.  Each qualifying source contributes a pair: its
            trimean <code>y</code> and its bootstrap variance <code>v</code>.
          </p>
          <p style={pStyle}>
            We first measure how much the sources genuinely <em>disagree</em>, using the
            meta-analysis machinery of DerSimonian&ndash;Laird &mdash; the same method used to
            pool independent medical studies:
          </p>

          <SpecCard label="BETWEEN-SOURCE HETEROGENEITY (DerSimonian–Laird)">
            <Formula>{`w_j = 1 / v_j                 mu = sum(w_j x y_j) / sum(w_j)
Q   = sum( w_j x (y_j - mu)^2 )
C   = sum(w_j) - sum(w_j^2) / sum(w_j)
tau^2 = max( 0 , (Q - (k-1)) / C )     between-source variance
I^2   = max( 0 , (Q - (k-1)) / Q )     share of spread that is real`}</Formula>
          </SpecCard>

          <p style={pStyle}>
            Then we answer the two questions separately.  <strong>Capacity</strong> &mdash; the
            big headline number &mdash; is what the tests that can actually saturate your line
            agree on.  We take the top tier (every source within 15% of the fastest) and compute
            a capability-weighted robust mean over just those members:
          </p>

          <SpecCard label="CAPACITY (headline)">
            <Formula>{`tier = { j : y_j >= 0.85 x max(y) }     (if k>=3 and fewer than 2, take top-2)
w'_j = capability_j / (v_j + tau^2)
capacity = sum_tier( w'_j x y_j ) / sum_tier( w'_j )`}</Formula>
          </SpecCard>

          <p style={pStyle}>
            <strong>Consensus</strong> is the conservative counterpart: a random-effects average
            across <em>all</em> qualifying sources, including the slower single-stream tests.
            When capacity and consensus sit close together, everything agreed; a gap between them
            means some sources saw a lower ceiling.
          </p>

          <SpecCard label="CONSENSUS (secondary) + CONFIDENCE INTERVAL">
            <Formula>{`w*_j = 1 / (v_j + tau^2)
consensus = sum( w*_j x y_j ) / sum( w*_j )

Hartung-Knapp-Sidik-Jonkman interval:
  q  = sum( w*_j x (y_j - estimate)^2 ) / (k-1)
  SE = sqrt( max(1, q) / sum(w*_j) )
  CI = estimate  +/-  t(k-1, 0.975) x SE`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              Confidence intervals use the <strong>Hartung&ndash;Knapp&ndash;Sidik&ndash;Jonkman</strong>{' '}
              small-sample correction on the random-effects model (its t-table is hardcoded for
              df &le; 7 and clamped above).  The capacity interval uses the same machinery,
              restricted to the tier members.
            </p>
          </SpecCard>

          <p style={pStyle}>
            Three guard rails keep the merge honest.  Any single source is capped at{' '}
            <strong> 70%</strong> of the total weight, so no one test can dominate.  A source
            whose variance can't be estimated is assigned the <strong>maximum</strong> known
            variance (least trusted).  And the small-count cases are handled explicitly: with{' '}
            <strong> two</strong> sources the between-source variance is untrustworthy, so we
            report an honest union band instead of a false-precision interval and mark agreement
            "insufficient"; with a <strong>single</strong> source there is no merge at all &mdash;
            that source's own bootstrap interval stands.
          </p>

          <SpecCard label="CAPABILITY PRIORS (used in the capacity weight)">
            <table style={tableStyle}>
              <tbody>
                <TableRow boldFirst cells={['Cloudflare · fast.com · Apple', '1.00 — full multi-stream / capacity-class']} />
                <TableRow boldFirst cells={['LibreSpeed · CacheFly · Vultr', '0.95 — strong, but single-endpoint or download-only']} />
                <TableRow boldFirst cells={['M-Lab MSAK', '0.85 — two-stream measurement']} />
                <TableRow boldFirst cells={['M-Lab NDT7', '0.70 — single stream; reads low under cross-traffic by design']} />
              </tbody>
            </table>
          </SpecCard>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 07 Agreement (I²) ── */}
        <Section num={7} title="AGREEMENT (I²)">
          <TtDr>
            When the different tests disagree, that's not a broken test &mdash; it's a clue.  We
            show you how closely they matched, and explain that a busy line or a
            bandwidth-sharing router will legitimately make some tests read lower than others.
          </TtDr>
          <p style={pStyle}>
            Older versions of this tool flagged "provider divergence" whenever two providers
            differed by more than 30% &mdash; a crude, arbitrary threshold.  Version 4 replaces
            it with <strong>I&sup2;</strong>, a standard heterogeneity statistic from
            meta-analysis.  I&sup2; answers a sharper question: of all the spread between your
            sources, how much is <em>real disagreement</em> versus ordinary sampling noise?  We
            band the result into four levels.
          </p>

          <SpecCard label="AGREEMENT BANDS">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>I&sup2;</th>
                  <th style={thStyle}>Band</th>
                  <th style={thStyle}>How It's Shown</th>
                </tr>
              </thead>
              <tbody>
                <TableRow cells={[
                  <span key="h" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}>{'< 0.25'}</span>,
                  <strong key="hb">High</strong>,
                  'Normal presentation — the headline is rock-solid.',
                ]} />
                <TableRow cells={[
                  <span key="m" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}>{'0.25 – 0.50'}</span>,
                  <strong key="mb">Moderate</strong>,
                  'Normal presentation — minor spread, headline reliable.',
                ]} />
                <TableRow cells={[
                  <span key="l" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}>{'0.50 – 0.75'}</span>,
                  <strong key="lb">Low</strong>,
                  'A caution chip appears — check the ± range and consensus.',
                ]} />
                <TableRow cells={[
                  <span key="v" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}>{'> 0.75'}</span>,
                  <strong key="vb">Very low</strong>,
                  'We show the range, not a single headline number.',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            Crucially, <strong>disagreement is diagnostic, never failure</strong>.  Modern
            routers and ISP equipment use active queue management and fair-queuing that
            deliberately share bandwidth per connection.  On a busy line, a single-connection
            test (like NDT7) will legitimately read lower than a many-connection test &mdash;
            not because either is wrong, but because they're asking slightly different questions.
          </p>
          <p style={pStyle}>
            So when single-flow and multi-flow figures diverge materially, we disclose both
            (flow-count transparency) rather than papering over the gap.  Read the headline as
            what your line demonstrated it can do, the consensus as the cautious average, and
            the &plusmn; range as the honest spread.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 08 Jitter (PDV) ── */}
        <Section num={8} title="JITTER AS PDV">
          <TtDr>
            Jitter is how much your ping jumps around.  We measure it as the gap between your
            typical ping and your slow ones &mdash; the swing that actually makes calls choppy
            &mdash; rather than an abstract running average.
          </TtDr>
          <p style={pStyle}>
            Low, steady latency is what makes a voice call sound natural and a game feel
            responsive.  Jitter measures how much that latency wobbles.  Our canonical figure is{' '}
            <strong> Packet Delay Variation (PDV)</strong>, in the spirit of RFC 5481: the gap
            between your typical ping and your slow ping.
          </p>

          <SpecCard label="JITTER FIGURES">
            <Formula>{`PDV = P95(RTT) - P50(RTT)                  canonical (RFC 5481)
IPDV = mean | RTT_i - RTT_{i-1} |          secondary
MAD x 1.4826                               secondary (robust spread)
RFC 3550:  J += ( |D| - J ) / 16           compatibility field only`}</Formula>
          </SpecCard>

          <p style={pStyle}>
            PDV is what you actually feel: it captures the real spread between a good moment and
            a bad one.  We also report the mean consecutive-difference (IPDV) and a robust
            median-based spread as secondary figures.  The old <strong>RFC 3550</strong> EWMA
            &mdash; the exponential moving average used by VoIP systems, and our former headline
            &mdash; is retained purely as a compatibility field, so results remain comparable to
            tools that still lead with it.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 09 Bufferbloat + Responsiveness ── */}
        <Section num={9} title="BUFFERBLOAT & RESPONSIVENESS">
          <TtDr>
            The most common reason a "fast" connection feels awful: latency balloons the moment
            the line gets busy, so calls stutter while a download runs.  We measure that extra
            delay in plain milliseconds and grade it, and report how responsive you stay
            under load.
          </TtDr>
          <p style={pStyle}>
            Here's a scenario most people have lived through: you're on a video call, and someone
            starts downloading a large file.  Suddenly your call turns into a slideshow.  Your
            ISP promised 300 Mbps, and you're getting 300 Mbps.  So why is everything terrible?
          </p>
          <p style={pStyle}>
            The answer is bufferbloat.  When your router receives more data than it can forward,
            it stuffs the excess into an oversized queue.  Packets sit in line for hundreds of
            milliseconds before delivery.  Your bandwidth is fine; your latency is catastrophic.
          </p>
          <p style={pStyle}>
            We measure it as an absolute latency penalty in milliseconds &mdash; not a ratio.  A
            ratio unfairly punishes an already-fast connection (a jump from 5 ms to 20 ms is a
            4&times; ratio but perfectly fine), so we grade the raw delta and disclose the ratio
            only as a secondary figure.
          </p>

          <SpecCard label="BUFFERBLOAT GRADING (delta, in ms)">
            <Formula>{`delta = P95(loaded RTT) - P50(idle RTT)
loaded RTT sampled during Cloudflare saturation
(200 ms throttle, max 50 points per direction)`}</Formula>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>Added Latency</th>
                  <th style={thStyle}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <TableRow cells={[
                  <span key="ap" style={{ fontWeight: 700, fontSize: '1rem' }}>A+</span>,
                  <span key="apr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 5 ms'}</span>,
                  'Latency barely moves under load. Smart queue management at work.',
                ]} />
                <TableRow cells={[
                  <span key="a" style={{ fontWeight: 700, fontSize: '1rem' }}>A</span>,
                  <span key="ar" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 30 ms'}</span>,
                  'Excellent. Minimal buffering.',
                ]} />
                <TableRow cells={[
                  <span key="b" style={{ fontWeight: 700, fontSize: '1rem' }}>B</span>,
                  <span key="br" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 60 ms'}</span>,
                  'Good. Acceptable for most uses.',
                ]} />
                <TableRow cells={[
                  <span key="c" style={{ fontWeight: 700, fontSize: '1rem' }}>C</span>,
                  <span key="cr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 200 ms'}</span>,
                  'Noticeable. VoIP and video calls may degrade under load.',
                ]} />
                <TableRow cells={[
                  <span key="d" style={{ fontWeight: 700, fontSize: '1rem' }}>D</span>,
                  <span key="dr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'< 400 ms'}</span>,
                  'Significant bufferbloat. Real-time apps suffer.',
                ]} />
                <TableRow cells={[
                  <span key="f" style={{ fontWeight: 700, fontSize: '1rem' }}>F</span>,
                  <span key="fr" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'>= 400 ms'}</span>,
                  'Severe. Fast on paper, miserable in practice.',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            We pair that with a <strong>Responsiveness (RPM)</strong> figure &mdash;
            round-trips-per-minute while the connection is under working load, aligned with the
            IETF responsiveness draft:
          </p>

          <SpecCard label="RESPONSIVENESS">
            <Formula>{`RPM = 60000 / P50( loaded RTT in ms )`}</Formula>
            <p style={{ ...pStyle, margin: 0 }}>
              Higher is better.  We label it <em>approximate</em> because our browser probes are
              same-origin multiplexed rather than the full foreign-plus-self probe design the
              draft specifies.
            </p>
          </SpecCard>

          <p style={pStyle}>
            Most speed tests don't measure any of this.  They test bandwidth in isolation,
            declare your connection fast, and leave you wondering why Netflix buffers every time
            someone joins a call.  In practice, latency under load is the single most common
            cause of poor internet quality that goes undiagnosed.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 10 Packet Loss ── */}
        <Section num={10} title="PACKET LOSS">
          <TtDr>
            Sometimes data simply never arrives, which causes stutter and rubber-banding even at
            high speeds.  We measure that loss directly &mdash; and if we can't measure it, we
            say so rather than guessing.
          </TtDr>
          <p style={pStyle}>
            Bandwidth and latency don't tell the whole story.  If packets are being dropped
            outright, every loss triggers a retransmit &mdash; the stutter in a call, the
            rubber-band in a game, the stall in a stream &mdash; even when your speed looks great.
          </p>
          <p style={pStyle}>
            We measure it the way real-time traffic experiences it: over <strong>UDP</strong>.
            The engine sends <strong>1000 UDP packets</strong> through a Cloudflare Realtime{' '}
            <strong> TURN</strong> relay and reports the share that never came back, as a
            percentage.
          </p>
          <p style={pStyle}>
            If the TURN relay is unreachable, packet loss is reported as <strong>unavailable</strong>
            &mdash; never fabricated, never quietly shown as zero.  Where a source exposes its own
            TCP-derived loss signal (NDT7 does), we surface it in the per-source drill-down as
            additional context.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 11 Stability ── */}
        <Section num={11} title="CONNECTION STABILITY">
          <TtDr>
            A connection that averages fast but lurches up and down feels worse than a slower
            steady one.  We measure how steady your speed held, separately for download
            and upload.
          </TtDr>
          <p style={pStyle}>
            A connection that averages 500 Mbps sounds great.  But if it swings between 50 and
            900 Mbps every few seconds, your experience will be terrible.  Streaming buffers,
            downloads stall and resume, games rubberband.  The average means nothing if the
            variance is high.
          </p>
          <p style={pStyle}>
            We quantify stability with the <strong>coefficient of variation</strong> (CV) &mdash;
            the ratio of standard deviation to mean &mdash; computed separately for download and
            upload.  A connection is marked <strong>stable</strong> when its CV is below{' '}
            <strong> 0.15</strong>; below 0.10 is rock-solid, fiber-like consistency.
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
                <TableRow boldFirst cells={['0.10 – 0.15', 'Good', 'Minor fluctuations.  Stable for all uses.']} />
                <TableRow boldFirst cells={['0.15 – 0.20', 'Fair', 'Noticeable variation.  Shared medium or mild congestion.']} />
                <TableRow boldFirst cells={['0.20 – 0.40', 'Variable', 'Significant swings.  Wireless interference, peak-hour congestion.']} />
                <TableRow boldFirst cells={['> 0.40', 'Poor', 'Highly unstable.  Packet loss, severe congestion, or throttling.']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            Because it's computed per direction, the split is diagnostic: a connection that's
            stable on download but variable on upload often points to wireless interference or
            asymmetric QoS policies from the ISP.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 12 DNS + Network Identity ── */}
        <Section num={12} title="DNS & NETWORK IDENTITY">
          <TtDr>
            Before any web page loads, your device has to look up the address &mdash; a slow
            lookup makes everything feel sluggish no matter how fast your line is.  We time that
            step, and show you who's carrying your traffic and where it's going.
          </TtDr>
          <p style={pStyle}>
            When you type a URL, the first thing your browser does is translate the domain name
            into an IP address.  If your DNS resolver is slow, every page load starts with a
            penalty before a single byte of content moves.  We probe 12 major domains in
            parallel, timing four distinct phases of each connection with the Performance
            Resource Timing API.
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
                <TableRow boldFirst cells={['TTFB', 'Time to first byte — how quickly the server begins responding']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            The 12 targets span the major content providers and CDNs behind most everyday
            traffic: Google, Cloudflare, Apple, Microsoft, Amazon, Netflix, GitHub, Wikipedia,
            Facebook, Twitter, YouTube, and Reddit.  If any are slow or unreachable, you'll know
            &mdash; and you'll know whether the bottleneck is DNS resolution, TCP connectivity,
            TLS negotiation, or server response.
          </p>
          <p style={pStyle}>
            Alongside it, we surface your <strong>network identity</strong> so you can see where
            your data travels:
          </p>
          <p style={pStyle}>
            <strong>ISP &amp; ASN</strong> &mdash; your Internet Service Provider and their
            Autonomous System Number, the unique identifier for their network in the global
            routing system.  <strong>Edge server</strong> &mdash; the Cloudflare data center
            handling your test, shown by its IATA airport code (e.g., DFW for Dallas&ndash;Fort
            Worth); a distant edge hints at suboptimal ISP routing.  <strong>IPv4 vs IPv6</strong>
            &mdash; which protocol your connection uses, since some ISPs route the two differently.
          </p>
          <p style={pStyle}>
            All of this is <strong>observability only</strong>.  It's fetched from Cloudflare's
            edge response headers in parallel with the latency test &mdash; adding zero time to
            the measurement &mdash; and it is <em>never</em> merged into your speed or latency
            numbers.  Your data stays in your browser.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 13 One Methodology, Three Products ── */}
        <Section num={13} title="ONE METHODOLOGY, THREE PRODUCTS">
          <TtDr>
            The exact same math runs on this website, in our iOS app, and in our command-line
            tool &mdash; down to identical results on identical inputs.  Any result can be
            traced back to the precise algorithm that produced it.
          </TtDr>
          <p style={pStyle}>
            Everything above is written down once, in a single versioned specification, and
            implemented in two languages: TypeScript (this website and the iOS app's engine) and
            Rust (the <code>speedqx</code> command-line tool).  A methodology that gives different
            answers on different platforms isn't trustworthy &mdash; so we enforce that they
            agree, exactly.
          </p>
          <p style={pStyle}>
            Parity is guaranteed by <strong>golden-vector fixtures</strong> &mdash; a shared file
            of known inputs and expected outputs (<code>golden-vectors.json</code>) committed
            byte-identically to all three repositories.  Every build checks itself against them.
          </p>

          <SpecCard label="PORTABILITY CONTRACT">
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Primitive</th>
                  <th style={thStyle}>Pinned Implementation</th>
                  <th style={thStyle}>Agreement</th>
                </tr>
              </thead>
              <tbody>
                <TableRow boldFirst cells={['Quantiles', 'Type-7 linear interpolation', 'Bit-exact']} />
                <TableRow boldFirst cells={['Random numbers', 'PCG32 + Lemire bounded index, fixed seed & stream', 'Bit-exact index streams']} />
                <TableRow boldFirst cells={['t-quantiles', 'Hardcoded table (df ≤ 7, clamped)', 'Bit-exact']} />
                <TableRow boldFirst cells={['Normal quantile / Φ', 'Acklam / Wichura AS241 rational approx.', '≤ 1e-9 relative']} />
                <TableRow boldFirst cells={['Float discipline', 'Fixed summation order; no FMA / fast-math', '—']} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            Arithmetic-only estimators &mdash; trimean, IQR, the plateau detector, the merge,
            PDV, bufferbloat &mdash; must match <strong>bit-for-bit</strong> across the two
            languages.  The transcendental paths (the BCa bootstrap, the confidence sequences)
            must match to one part in a billion.  The governing principle of version 4 is to{' '}
            <strong> prefer closed-form arithmetic</strong> over iterative or
            transcendental-heavy methods, precisely because exact two-language reproducibility is
            a product feature, not an afterthought.
          </p>
          <p style={pStyle}>
            Finally, every result payload &mdash; the JSON from the CLI, the share and clipboard
            text on the web and app, the numbers in the drill-down &mdash; carries a{' '}
            <strong> methodologyVersion</strong> stamp (currently <code>"4.0"</code>) and a{' '}
            <strong> platform</strong> tag (<code>web</code>, <code>app</code>, or <code>cli</code>).
            Any result you ever see can be traced to the exact algorithm that produced it.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 14 Comparison ── */}
        <Section num={14} title="WHY TRUST THIS OVER OTHER TESTS">
          <TtDr>
            Most tests give you one optimistic number and stop there.  Here's an honest,
            feature-by-feature look at what this measures that the popular tools don't &mdash;
            not to knock them, but to show what's different.
          </TtDr>
          <p style={pStyle}>
            We built this because the existing options leave gaps.  This comparison is meant to
            be fair &mdash; the mainstream tools are good at what they do &mdash; and to explain
            what's genuinely different here.
          </p>

          <SpecCard label="COMPARISON MATRIX">
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Feature</th>
                    <th style={thStyle}>SpeedQX</th>
                    <th style={thStyle}>Speedtest.net</th>
                    <th style={thStyle}>Fast.com</th>
                    <th style={thStyle}>Google</th>
                  </tr>
                </thead>
                <tbody>
                  <TableRow boldFirst cells={['Independent sources', <strong key="v">7 cross-validated (+Apple on CLI)</strong>, '1', '1 (Netflix)', '1']} />
                  <TableRow boldFirst cells={['Combine method', <strong key="v">Capacity + consensus</strong>, 'Single', 'Single', 'Single']} />
                  <TableRow boldFirst cells={['Headline statistic', <strong key="v">Modified trimean</strong>, '90th percentile', 'Undisclosed', 'Undisclosed']} />
                  <TableRow boldFirst cells={['Warm-up handling', <strong key="v">Plateau detector</strong>, 'Partial', 'Undisclosed', 'Undisclosed']} />
                  <TableRow boldFirst cells={['Outlier filtering', <strong key="v">IQR + block bootstrap</strong>, 'Undisclosed', 'Undisclosed', 'No']} />
                  <TableRow boldFirst cells={['Latency under load', <strong key="v">Bufferbloat A–F + RPM</strong>, 'Loaded latency', 'Loaded latency', 'No']} />
                  <TableRow boldFirst cells={['Stability (CV)', <strong key="v">Yes, per direction</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Latency detail', <strong key="v">Min-RTT + P50/P95/P99</strong>, 'Median + loaded', 'Latency only', 'Ping only']} />
                  <TableRow boldFirst cells={['Jitter', <strong key="v">PDV (+RFC 3550)</strong>, 'Basic', 'No', 'No']} />
                  <TableRow boldFirst cells={['Packet loss', <strong key="v">UDP via TURN</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Source agreement', <strong key="v">I² bands</strong>, 'N/A', 'N/A', 'N/A']} />
                  <TableRow boldFirst cells={['Confidence interval', <strong key="v">95% (HKSJ + bootstrap)</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['DNS diagnostics', <strong key="v">12 domains</strong>, 'No', 'No', 'No']} />
                  <TableRow boldFirst cells={['Open methodology', <strong key="v">Versioned public spec</strong>, 'Partial', 'No', 'No']} />
                  <TableRow boldFirst cells={['Cross-product parity', <strong key="v">Web + app + CLI</strong>, 'N/A', 'N/A', 'N/A']} />
                </tbody>
              </table>
            </div>
          </SpecCard>

          <p style={pStyle}>
            Speedtest.net has been the default for two decades and does its job well &mdash; but
            its single-provider, 90th-percentile headline produces optimistic numbers that may
            not reflect your lived experience.  Fast.com is Netflix's tool, built mainly to check
            whether your ISP throttles Netflix traffic, and its core methodology is undocumented.
            Google's built-in test is a quick single-server check with no advanced metrics.
          </p>
          <p style={pStyle}>
            None of them cross-validate across independent sources, separate demonstrated
            capacity from a cautious consensus, or attach a real confidence interval.  These
            aren't niche features &mdash; they're the context that explains why a "fast"
            connection can still feel slow.
          </p>
        </Section>

        <hr style={dividerStyle} />

        {/* ── 15 Standards ── */}
        <Section num={15} title="BUILT ON STANDARDS">
          <TtDr>
            None of this is invented math.  Every method here comes from a published internet
            standard or peer-reviewed research, and we cite all of it.
          </TtDr>
          <p style={pStyle}>
            We don't invent our own statistics.  Every method and threshold used in this tool is
            grounded in a published standard, peer-reviewed research, or established industry
            methodology.
          </p>

          <SpecCard label="STANDARDS AND REFERENCES">
            <table style={tableStyle}>
              <tbody>
                <TableRow boldFirst cells={[
                  'RFC 5481',
                  'Packet Delay Variation — the basis for our canonical jitter figure',
                ]} />
                <TableRow boldFirst cells={[
                  'RFC 3550',
                  'RTP EWMA jitter — retained as a legacy compatibility field',
                ]} />
                <TableRow boldFirst cells={[
                  'IETF Responsiveness draft',
                  'draft-ietf-ippm-responsiveness — the RPM (round-trips-per-minute) measure',
                ]} />
                <TableRow boldFirst cells={[
                  'DerSimonian & Laird (1986)',
                  'Random-effects meta-analysis — the between-source τ² and I² heterogeneity',
                ]} />
                <TableRow boldFirst cells={[
                  'Hartung–Knapp–Sidik–Jonkman',
                  'Small-sample correction for the random-effects confidence interval',
                ]} />
                <TableRow boldFirst cells={[
                  'Higgins I²',
                  'The agreement statistic and its banding',
                ]} />
                <TableRow boldFirst cells={[
                  'Efron BCa bootstrap',
                  'Bias-corrected accelerated confidence intervals for the per-source estimate',
                ]} />
                <TableRow boldFirst cells={[
                  'Circular block bootstrap',
                  'Politis; Hall–Horowitz–Jing block length — resampling autocorrelated samples',
                ]} />
                <TableRow boldFirst cells={[
                  'Waudby-Smith & Ramdas',
                  'Anytime-valid confidence sequences — FAST-mode early stopping',
                ]} />
                <TableRow boldFirst cells={[
                  'Ookla Speed Score',
                  'Modified trimean (P10:P50:P90 at 1:8:1) for the bandwidth location estimate',
                ]} />
                <TableRow boldFirst cells={[
                  'M-Lab NDT7 / MSAK',
                  'Open-source single- and multi-stream TCP measurement by Measurement Lab',
                ]} />
                <TableRow boldFirst cells={[
                  'Cloudflare AIM',
                  'Aggregated Internet Measurement quality scores',
                ]} />
                <TableRow boldFirst cells={[
                  'PerformanceResourceTiming',
                  'W3C standard for high-precision browser timing extraction',
                ]} />
              </tbody>
            </table>
          </SpecCard>

          <p style={pStyle}>
            The canonical, byte-identical specification shared across all three products is{' '}
            <a
              href="https://github.com/QubeTX/speedtest/blob/main/METHODOLOGY.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: colors.ink,
                fontWeight: 600,
                textDecorationThickness: '2px',
                textUnderlineOffset: '3px',
              }}
            >
              METHODOLOGY.md
            </a>
            ; the engineering companion, with implementation notes, is{' '}
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
            </a>
            .  Nothing is hidden.  Every decision is explained.
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
            BUILT BY QUBETX &middot; MEASUREMENT YOU CAN TRUST &middot; METHODOLOGY 4.0
          </p>
        </footer>

      </article>
    </div>
  );
}
