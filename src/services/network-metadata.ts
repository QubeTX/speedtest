/**
 * Network metadata service.
 *
 * Fetches IP, ISP/ASN, geolocation, edge server, and TCP metrics
 * from Cloudflare's speed test endpoint headers and ipinfo.io.
 */

import type { NetworkMetadata } from '../types/speedtest';
import { coloToCity } from '../data/colo-map';

const CF_ENDPOINT = 'https://speed.cloudflare.com/__down?bytes=0';
const IPINFO_ENDPOINT = 'https://ipinfo.io/json';
const FETCH_TIMEOUT = 3000;

/** Parse server-timing header for TCP kernel metrics. */
function parseServerTiming(header: string | null): { rtt: number | null; minRtt: number | null } {
  if (!header) return { rtt: null, minRtt: null };
  const rttMatch = header.match(/[&?]rtt=(\d+)/);
  const minRttMatch = header.match(/min_rtt=(\d+)/);
  return {
    rtt: rttMatch ? parseInt(rttMatch[1], 10) / 1000 : null,       // µs → ms
    minRtt: minRttMatch ? parseInt(minRttMatch[1], 10) / 1000 : null,
  };
}

/** Parse ipinfo.io org field: "AS7018 AT&T Enterprises, LLC" → { asn, name } */
function parseOrg(org: string | undefined): { asn: number | null; name: string | null } {
  if (!org) return { asn: null, name: null };
  const match = org.match(/^AS(\d+)\s+(.+)$/);
  if (match) return { asn: parseInt(match[1], 10), name: match[2] };
  return { asn: null, name: org };
}

interface CfHeaders {
  ip: string | null;
  asn: number | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  postalCode: string | null;
  timezone: string | null;
  colo: string | null;
  tcpRtt: number | null;
  tcpMinRtt: number | null;
}

async function fetchCfHeaders(signal?: AbortSignal): Promise<CfHeaders> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(`${CF_ENDPOINT}&_t=${Date.now()}`, {
      mode: 'cors',
      cache: 'no-store',
      signal: combinedSignal,
    });

    // Try cf-meta-* prefixed headers first (CORS-exposed), fall back to non-prefixed
    const getH = (name: string) =>
      res.headers.get(`cf-meta-${name}`) ?? res.headers.get(name) ?? null;

    const tcp = parseServerTiming(res.headers.get('server-timing'));
    const asnStr = getH('asn');

    return {
      ip: getH('ip'),
      asn: asnStr ? parseInt(asnStr, 10) : null,
      city: getH('city'),
      country: getH('country'),
      latitude: getH('latitude') ? parseFloat(getH('latitude')!) : null,
      longitude: getH('longitude') ? parseFloat(getH('longitude')!) : null,
      postalCode: getH('postalCode') ?? getH('postalcode'),
      timezone: getH('timezone'),
      colo: getH('colo') ?? res.headers.get('colo'),
      tcpRtt: tcp.rtt,
      tcpMinRtt: tcp.minRtt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

interface IpInfoResult {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
}

async function fetchIpInfo(signal?: AbortSignal): Promise<IpInfoResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(IPINFO_ENDPOINT, { signal: combinedSignal });
    if (!res.ok) return null;
    return await res.json() as IpInfoResult;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch network metadata from Cloudflare headers + ipinfo.io.
 * Runs both in parallel, merges results. CF is primary; ipinfo enriches ISP name + region.
 */
export async function fetchNetworkMetadata(signal?: AbortSignal): Promise<NetworkMetadata> {
  const [cfResult, ipResult] = await Promise.allSettled([
    fetchCfHeaders(signal),
    fetchIpInfo(signal),
  ]);

  const cf = cfResult.status === 'fulfilled' ? cfResult.value : null;
  const ipinfo = ipResult.status === 'fulfilled' ? ipResult.value : null;

  // Merge: CF headers primary, ipinfo enriches
  const ip = cf?.ip ?? ipinfo?.ip ?? null;
  const { asn: ipinfoAsn, name: ispName } = parseOrg(ipinfo?.org);
  const asn = cf?.asn ?? ipinfoAsn;

  const colo = cf?.colo ?? null;

  return {
    ip,
    ipVersion: ip ? (ip.includes(':') ? 6 : 4) : null,
    isp: ispName,
    asn,
    ispFull: ispName && asn ? `${ispName} (AS${asn})` : ispName ?? (asn ? `AS${asn}` : null),
    city: cf?.city ?? ipinfo?.city ?? null,
    region: ipinfo?.region ?? null,
    country: cf?.country ?? ipinfo?.country ?? null,
    postalCode: cf?.postalCode ?? ipinfo?.postal ?? null,
    latitude: cf?.latitude ?? (ipinfo?.loc ? parseFloat(ipinfo.loc.split(',')[0]) : null),
    longitude: cf?.longitude ?? (ipinfo?.loc ? parseFloat(ipinfo.loc.split(',')[1]) : null),
    timezone: cf?.timezone ?? ipinfo?.timezone ?? null,
    colo,
    coloCity: colo ? coloToCity(colo) : null,
    tlsVersion: null,   // Populated from cdn-cgi/trace if needed later
    httpVersion: null,
    tcpRtt: cf?.tcpRtt ?? null,
    tcpMinRtt: cf?.tcpMinRtt ?? null,
    fetchedAt: Date.now(),
  };
}
