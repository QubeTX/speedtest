/**
 * Vercel Edge Function: fast.com (Netflix) OCA target discovery relay.
 *
 * Browsers can't read fast.com's live API token off the wire on every page
 * load without hitting fast.com's own CORS policy (which does not extend to
 * this origin) — this relay runs the same token-extraction flow server-side
 * that qube-network-diagnostics does natively in Rust (see
 * `qube-network-diagnostics/src/speedtest/fastcom.rs`) and hands the browser
 * a ready-to-use list of OCA (Open Connect Appliance) target URLs.
 *
 * Flow (mirrors fastcom.rs::extract_token + the netflix/speedtest/v2 call):
 *   1. GET https://fast.com/ → regex the `app-*.js` bundle filename out of the HTML.
 *   2. GET https://fast.com/{bundle} → regex `token:"..."` out of the bundle source.
 *   3. On ANY failure above (network error, missing bundle, missing token),
 *      fall back to the long-stable public token also used by fastcom.rs.
 *   4. GET https://api.fast.com/netflix/speedtest/v2?https=true&token=...&urlCount=5
 *      and relay `{ targets, client }` to the caller. If that call fails with a
 *      scraped token (e.g. the regex matched a wrong-but-present literal), it is
 *      retried once with FALLBACK_TOKEN before giving up.
 *
 * Never fabricates data: if step 4 fails even with the fallback token, this
 * responds non-200 (with a small JSON error body) so the browser-side
 * provider (`src/services/fastcom-provider.ts`) can fail gracefully instead
 * of reporting a made-up number.
 *
 * CORS is wide open (`Access-Control-Allow-Origin: *`) because this endpoint
 * is also meant to be called cross-origin with an absolute URL from the
 * SpeedQX app's WebView (see the website repo's execution notes) — not just
 * same-origin from this website.
 */

export const config = { runtime: 'edge' };

const FAST_HOME_URL = 'https://fast.com/';
const FAST_API_URL = 'https://api.fast.com/netflix/speedtest/v2';

/**
 * Long-stable public fallback token — identical to fastcom.rs's FALLBACK_TOKEN.
 * The live scrape above is always attempted first; this is only the safety net.
 */
const FALLBACK_TOKEN = 'YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm';

/** Number of OCA target URLs requested per discovery call (mirrors fastcom.rs URL_COUNT). */
const URL_COUNT = 5;

const HTML_FETCH_TIMEOUT_MS = 4_000;
const JS_FETCH_TIMEOUT_MS = 4_000;
const DISCOVERY_TIMEOUT_MS = 8_000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape the live API token out of fast.com's own JS bundle. Throws on any
 * failure (network error, unexpected HTML/JS shape) — the caller falls back
 * to {@link FALLBACK_TOKEN} rather than propagating the error to the client.
 */
async function extractToken(): Promise<string> {
  const htmlRes = await fetchWithTimeout(FAST_HOME_URL, { headers: { Accept: 'text/html' } }, HTML_FETCH_TIMEOUT_MS);
  if (!htmlRes.ok) throw new Error(`fast.com page fetch failed: ${htmlRes.status}`);
  const html = await htmlRes.text();

  // fast.com's bundle is referenced as e.g. `app-2bffe1a9.js` somewhere in the
  // HTML (script src or preload link) — grab the first match regardless of
  // quoting style.
  const bundleMatch = html.match(/app-[\w.-]+\.js/i);
  if (!bundleMatch) throw new Error('fast.com: could not find JS bundle filename');
  const jsFilename = bundleMatch[0];

  const jsRes = await fetchWithTimeout(`https://fast.com/${jsFilename}`, {}, JS_FETCH_TIMEOUT_MS);
  if (!jsRes.ok) throw new Error(`fast.com JS bundle fetch failed: ${jsRes.status}`);
  const js = await jsRes.text();

  // Minified bundles keep object-literal key names intact, so `token:"..."`
  // (with or without a space after the colon, single or double quotes)
  // survives minification.
  const tokenMatch = js.match(/token\s*:\s*["']([^"']+)["']/);
  const token = tokenMatch?.[1];
  if (!token) throw new Error('fast.com: could not extract token from JS bundle');

  return token;
}

type DiscoveryResult =
  | { ok: true; targets: string[]; client: { ip: string | null; location: unknown } }
  | { ok: false; status: number; error: string };

/**
 * Run one `netflix/speedtest/v2` discovery call with the given token. Returns a
 * discriminated result rather than throwing so the caller can retry with a
 * different token (see the handler's FALLBACK_TOKEN retry). Network errors,
 * non-200s, and non-JSON bodies all map to `{ ok: false }`.
 */
async function discover(token: string): Promise<DiscoveryResult> {
  const apiUrl = `${FAST_API_URL}?https=true&token=${encodeURIComponent(token)}&urlCount=${URL_COUNT}`;
  try {
    const res = await fetchWithTimeout(apiUrl, { headers: { Accept: 'application/json' } }, DISCOVERY_TIMEOUT_MS);

    if (!res.ok) {
      return { ok: false, status: 502, error: `fast.com discovery returned ${res.status}` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: 502, error: 'fast.com discovery returned a non-JSON response' };
    }

    const data: any = await res.json();
    const rawTargets = Array.isArray(data?.targets) ? data.targets : [];
    const targets: string[] = rawTargets
      .map((t: any) => (t && typeof t.url === 'string' ? t.url : null))
      .filter((u: string | null): u is string => !!u);

    // Relay fast.com's own client block verbatim-ish; its exact shape isn't
    // publicly documented so we only guarantee the two fields the provider
    // side actually needs.
    const client = {
      ip: typeof data?.client?.ip === 'string' ? data.client.ip : null,
      location: data?.client?.location ?? null,
    };

    return { ok: true, targets, client };
  } catch (err) {
    console.warn('[fastcom-targets] discovery request failed:', err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: 'fast.com discovery request failed' };
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method not allowed', targets: [], client: null }, 405);
  }

  let token: string;
  try {
    token = await extractToken();
  } catch (err) {
    console.warn(
      '[fastcom-targets] token scrape failed, using fallback token:',
      err instanceof Error ? err.message : err,
    );
    token = FALLBACK_TOKEN;
  }

  // Extraction can succeed with a WRONG-but-present token (e.g. an analytics or
  // CSRF `token:"..."` literal that appears earlier in the bundle than the real
  // API token). That path never throws, so it wouldn't hit the fallback above —
  // if discovery then rejects it, retry ONCE with the long-stable FALLBACK_TOKEN
  // before giving up, so a scrape that lands on the wrong literal still recovers.
  let result = await discover(token);
  if (!result.ok && token !== FALLBACK_TOKEN) {
    console.warn(`[fastcom-targets] discovery failed with scraped token (${result.error}); retrying with fallback token`);
    result = await discover(FALLBACK_TOKEN);
  }

  if (!result.ok) {
    return jsonResponse({ error: result.error, targets: [], client: null }, result.status);
  }

  return jsonResponse({ targets: result.targets, client: result.client }, 200);
}
