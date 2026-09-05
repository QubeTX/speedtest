# Matching web and native typography

Date: 2026-09-05

The operator requested the website use the same font combination as the redesigned iOS app. Makira now supplies display and body text. Gail Rock supplies readings, instrument labels and numeric tables. The website keeps its existing layout and cassette motion.

The six existing Makira WOFF2 files are byte-identical to the supplied archive. The four new Gail Rock WOFF2 files are extracted from the supplied webfont exports. Their character maps and every glyph advance match the native TTF files; all digits are 650/1000 em. A few supplied web-export side bearings differ by one design unit, so the files are not described as identical native binaries.

Chrome confirmed loaded Makira and Gail Rock faces and their computed roles. At a phone viewport, local deterministic results include 125.00 Gbps and 1000 Mbps: digits and units remain together with no horizontal overflow. Desktop Settings fits 1920 x 855 with its footer visible. The local fixture replaces network providers outside the repository and is not shipped.

Production verification must confirm the deployment revision, loaded font roles and exact public font bytes after merge. Browser rendering and file identity checks do not establish physical-device acceptance.
