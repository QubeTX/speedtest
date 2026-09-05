// Disposable namespace fixture, never a production service.
import { startReference, scenarios } from './controlled-reference.mjs';
if (process.env.SPEEDQX_ISOLATED_REFERENCE !== '1') throw new Error('Isolated fixture opt-in required');
// Let the kernel bottleneck govern the path; application pacing is above it.
scenarios.steady.rate = () => 1000;
const reference = await startReference({ host: '192.0.2.2', port: 8800, maxRequestBytes: 250_000_000, diagnostics: true });
const stop = async () => { await reference.close(); process.exit(); };
process.once('SIGTERM', stop); process.once('SIGINT', stop);
console.log('Isolated TEST-NET-1 reference ready');
