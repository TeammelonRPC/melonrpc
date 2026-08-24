/**
 * MelonRPC — Edge Worker
 * Solana JSON-RPC endpoint with rate limiting and method allowlist.
 */

// @ts-ignore — Workers Sites manifest
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const manifest: Record<string, string> = JSON.parse(manifestJSON);

export interface Env {
  UPSTREAM_URL: string;
  UPSTREAM_KEY: string;
  RATE_LIMITER: RateLimit;
  __STATIC_CONTENT: KVNamespace;
}


const ALLOWED_METHODS = new Set([
  'getAccountInfo','getBalance','getBlock','getBlockHeight',
  'getBlockProduction','getBlockCommitment','getBlocks','getBlocksWithLimit',
  'getBlockTime','getClusterNodes','getEpochInfo','getEpochSchedule',
  'getFeeForMessage','getFirstAvailableBlock','getGenesisHash','getHealth',
  'getHighestSnapshotSlot','getIdentity','getInflationGovernor',
  'getInflationRate','getInflationReward','getLargestAccounts',
  'getLatestBlockhash','getLeaderSchedule','getMaxRetransmitSlot',
  'getMaxShredInsertSlot','getMinimumBalanceForRentExemption',
  'getMultipleAccounts','getProgramAccounts','getRecentPerformanceSamples',
  'getRecentPrioritizationFees','getSignatureStatuses',
  'getSignaturesForAddress','getSlot','getSlotLeader','getSlotLeaders',
  'getStakeActivation','getStakeMinimumDelegation','getSupply',
  'getTokenAccountBalance','getTokenAccountsByDelegate',
  'getTokenAccountsByOwner','getTokenLargestAccounts','getTokenSupply',
  'getTransaction','getTransactionCount','getVersion','getVoteAccounts',
  'isBlockhashValid','minimumLedgerSlot','sendTransaction',
]);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Solana-Client',
  'Access-Control-Max-Age': '86400',
};

function jsonRpcError(id: unknown, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }),
    { status: code === -32000 ? 429 : 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
  );
}

async function serveAsset(env: Env, filename: string): Promise<Response | null> {
  const key = manifest[filename] || filename;
  let content = await env.__STATIC_CONTENT.get(key, 'arrayBuffer');
  
  if (!content) {
    for (const [mKey, mVal] of Object.entries(manifest)) {
      if (mKey === filename || mKey === `/${filename}` || mKey.endsWith(`/${filename}`)) {
        content = await env.__STATIC_CONTENT.get(mVal as string, 'arrayBuffer');
        if (content) break;
      }
    }
  }
  
  if (!content) return null;
  
  // Determine content type
  let contentType = 'application/octet-stream';
  if (filename.endsWith('.html')) contentType = 'text/html; charset=utf-8';
  else if (filename.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
  else if (filename.endsWith('.css')) contentType = 'text/css; charset=utf-8';
  else if (filename.endsWith('.json')) contentType = 'application/json';
  else if (filename.endsWith('.png')) contentType = 'image/png';
  else if (filename.endsWith('.ico')) contentType = 'image/x-icon';
  else if (filename.endsWith('.svg')) contentType = 'image/svg+xml';
  else if (filename.endsWith('.xml')) contentType = 'application/xml';
  else if (filename.endsWith('.txt')) contentType = 'text/plain';
  else if (filename.endsWith('.woff2')) contentType = 'font/woff2';
  else if (filename.endsWith('.woff')) contentType = 'font/woff';
  
  return new Response(content, {
    status: 200,
    headers: { 
      'Content-Type': contentType,
      'Cache-Control': filename.includes('_next/') ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      // CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // Serve static pages for GET
      if (request.method === 'GET') {
        let filename = '';
        if (pathname === '/' || pathname === '') filename = 'index.html';
        else if (pathname === '/documentation' || pathname === '/documentation/') filename = 'documentation.html';
        else if (pathname === '/playground' || pathname === '/playground/') filename = 'playground.html';
        else filename = pathname.startsWith('/') ? pathname.slice(1) : pathname;

        if (filename) {
          const page = await serveAsset(env, filename);
          if (page) return page;
        }
        const notFound = await serveAsset(env, '404.html');
        if (notFound) return new Response(notFound.body, { status: 404, headers: notFound.headers });
        return new Response('Not found', { status: 404 });
      }

      // POST — JSON-RPC proxy
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }

      // Rate limiting
      const clientIp = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp });
      if (!success) return jsonRpcError(null, -32000, 'Rate limited. Please slow down.');

      // Parse body
      let body: any;
      try { body = await request.json(); }
      catch { return jsonRpcError(null, -32700, 'Parse error: invalid JSON'); }

      const isBatch = Array.isArray(body);
      const reqs = isBatch ? body : [body];

      // Validate methods
      for (const req of reqs) {
        if (!req.method || typeof req.method !== 'string')
          return jsonRpcError(req?.id, -32600, 'Invalid request: missing method');
        if (!ALLOWED_METHODS.has(req.method))
          return jsonRpcError(req.id, -32601, `Method not allowed: ${req.method}`);
      }

      // Forward to upstream
      const rpcUrl = `${env.UPSTREAM_URL}/?api-key=${env.UPSTREAM_KEY}`;
      const upstream = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isBatch ? reqs : reqs[0]),
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });

    } catch (err: any) {
      return new Response(
        JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  },
};
