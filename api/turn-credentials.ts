// Vercel Edge Function: mints short-lived Cloudflare Realtime TURN credentials for the
// packet-loss measurement (@cloudflare/speedtest `turnServerCredsApiUrl`).
// Env: REALTIME_TURN_TOKEN_ID, REALTIME_TURN_TOKEN_SECRET (Vercel project settings).
// Without them this returns 501 and the client falls back to the engine's default TURN.

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = new Set([
  'https://speedqx.com',
  'https://www.speedqx.com',
  'https://speed.qubetx.com',
  'https://speed.emmetts.dev',
  'https://speed.shaughv.com',
  'https://speedtest.qubetx.com',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'content-type': 'application/json',
  };
  // No Origin header (native WebView / server-side callers) needs no ACAO.
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith('.vercel.app') || origin === 'null')) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'origin';
  }
  return headers;
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(origin), 'access-control-allow-methods': 'GET, OPTIONS' },
    });
  }

  const tokenId = process.env.REALTIME_TURN_TOKEN_ID;
  const tokenSecret = process.env.REALTIME_TURN_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    return new Response(JSON.stringify({ error: 'turn-not-configured' }), {
      status: 501,
      headers: corsHeaders(origin),
    });
  }

  try {
    const mint = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ttl: 600 }),
      },
    );
    if (!mint.ok) {
      return new Response(JSON.stringify({ error: 'mint-failed', status: mint.status }), {
        status: 502,
        headers: corsHeaders(origin),
      });
    }
    const data = (await mint.json()) as {
      iceServers: Array<{ urls: string[]; username: string; credential: string }>;
    };
    const server = data.iceServers?.[0];
    if (!server?.username || !server?.credential) {
      return new Response(JSON.stringify({ error: 'mint-malformed' }), {
        status: 502,
        headers: corsHeaders(origin),
      });
    }
    // The packet-loss engine needs the UDP relay; expose udp turn: urls plus creds in the
    // { username, credential } shape @cloudflare/speedtest expects from turnServerCredsApiUrl.
    const udpUrls = server.urls.filter((u) => u.startsWith('turn:') && u.includes('transport=udp'));
    return new Response(
      JSON.stringify({ username: server.username, credential: server.credential, urls: udpUrls }),
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch {
    return new Response(JSON.stringify({ error: 'mint-error' }), {
      status: 502,
      headers: corsHeaders(origin),
    });
  }
}
