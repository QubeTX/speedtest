# Human Changelog

A plain-English companion to [CHANGELOG.md](CHANGELOG.md).

## September 5, 2026 — Cassette icon and smoother resets (4.0.1)

- The browser tab now carries a crisp cassette icon that matches the speed test.
- Each fresh visit starts with Quick selected. Deep remains available for the current visit, and your other settings stay saved.
- Starting over after a completed test briefly rewinds the cassette and clears the readings smoothly. The panel eases into place instead of snapping, and reduced-motion preferences are respected.
- Settings fits comfortably on a normal-height desktop screen without an unnecessary tiny scroll. Smaller windows can still scroll to every option.

## September 5, 2026 — Sustained measurement and a clearer instrument

This release includes the testing limits described below.

**Changed**

- Speed results now describe the data the tested device sustained over the measurement period. Slow stretches and brief stalls count, including during uploads. This describes the tested device and route, not the physical capacity promised by an internet plan.
- Quick is the starting choice everywhere. Deep spends longer checking the same main networks and adds supporting tests. A result based on only one main source says so, and extra tests cannot silently raise the headline.
- An estimated ceiling appears only when a speed at or above the sustained result repeats for long enough. A repeated slower stretch cannot become a misleading ceiling. The details expose disagreement and variation instead of presenting a precise-looking accuracy guarantee.
- Ping now describes a typical idle web request. Delay during downloads, delay during uploads, failed web probes and server connection signals have distinct labels; missing packet-loss evidence stays unavailable.
- You can choose a data ceiling, see transferred data, and stop a run while retaining usable partial results. Backgrounding the app or changing networks ends comparable collection. The choice to use M-Lab includes its publication policy.

**Validation**

- New automated cases reproduce stalls, changing speed, incomplete transfers, provider failures and cancellation. Controlled local comparisons check the bytes actually delivered. Physical-device checks are still pending, and comparisons on paths with random packet loss missed the repeatability target. Publication was authorized with these limits disclosed; the results do not guarantee the capacity of an internet plan.

**Instrument and details**

- The redrawn cassette shows measured transfer activity, slows for a stall and reverses for uploads. A small pulse distinguishes initial connection checks from data transfer, and reduced-motion preferences are respected. The two speed results lead the screen, with ceilings underneath and technical detail close at hand.
- The website and app share their measurement code and explanations, with automated checks to catch drift.
