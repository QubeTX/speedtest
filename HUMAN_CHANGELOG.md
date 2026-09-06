# Human Changelog

A plain-English companion to [CHANGELOG.md](CHANGELOG.md).

## September 6, 2026 — One cassette family across web and iPhone (4.0.5)

- The website's cassette now shares the blue-gray housing and darker reel window of the iPhone app's 3.1 update. Softer edges and a recessed control make the instrument feel like the same product on both screens.
- The web version keeps its extra mechanical details, black Start button and responsive reel animation. Speed measurements and controls work as before.

## September 6, 2026 — A little closer to the iPhone app (4.0.4)

- Lighter borders, softer gray panels and white grouped readings give the website more visual continuity with the iPhone app. Quick and Deep use a familiar inset selection, and headings and supporting text are easier to scan.
- The website keeps its detailed cassette and black Start control. Settings and result explanations share the quieter finish, with the same speed-test behavior, keyboard controls and reduced-motion support.

## September 5, 2026 — Matching fonts across web and iPhone

- The website uses the same Makira and Gail Rock pairing as the phone app. Headings and paragraphs use Makira; readings and instrument labels use Gail Rock.
- Longer readings adjust to their available space so every digit and its unit stay together. Desktop Settings still fits its window, and the cassette keeps its existing animation and smooth reset.

## September 5, 2026 — A clearer icon in small tabs (4.0.2)

- Simplified the cassette icon so its shape and two reel openings remain easier to distinguish in a small browser tab. Removed the extra surrounding square and fine details that blurred together.
- Added sharper small-icon fallbacks. Checked the design at actual favicon sizes on light and dark backgrounds and at several display densities. The larger Apple touch icon keeps its detailed design.

## September 5, 2026 — Cassette icon and smoother resets (4.0.1)

- The browser tab now carries a crisp cassette icon that matches the speed test.
- Each fresh visit starts with Quick selected. Deep remains available for the current visit, and your other settings stay saved.
- Starting over after a completed test briefly rewinds the cassette and clears the readings smoothly. The panel eases into place instead of snapping, and reduced-motion preferences are respected.
- Settings adjusts its spacing to fit desktop browser windows without an unnecessary tiny scroll. Smaller screens can still scroll to every option when needed.

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
