# SpeedQX accuracy evidence

SpeedQX measures sustained application throughput on the device and paths tested. Methodology v5 uses monotonic byte counters, a fixed two-second warm-up, and the median of qualifying Cloudflare and M-Lab MSAK primary estimates. NDT7 remains a separate single-stream comparison. A repeatable ceiling needs two non-overlapping three-second windows within 10%; it does not describe the ISP's physical line capacity.

Quick is the default, capped at 90 seconds and 5 GB of payload budget. Deep repeats the primary comparison with longer transfers, adds supplementary results, and is capped at five minutes and 20 GB. Both can use a smaller byte ceiling. M-Lab requires explicit consent to publication of measurement results and IP addresses. Without consent, the headline is labeled single-source. HTTP ping is the median idle RTT to the common Cloudflare reference; download-loaded and upload-loaded latency and HTTP failures are separate details. No nominal 95% accuracy claim or UDP loss estimate is inferred.

The normative contract is [METHODOLOGY.md](METHODOLOGY.md). Recorded candidate evidence is in [evidence/v5](evidence/v5). Application-level pacing validates delivered-byte accounting, not ISP capacity, physical radios, or packet-loss behavior. A v4 estimator replay is not a full legacy-transport comparison. Open acceptance gates remain visible in the release report.

[Historical v4 engineering report](docs/ACCURACY-v4.md).
