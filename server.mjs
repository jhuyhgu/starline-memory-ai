import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { APIError, createAIService, validateOrganizeInput, validateAskInput } from './ai.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8' };
const defaultLimits = { bodyBytes: 131072, maxConcurrent: 3, requestsPerMinute: 12, globalRequestsPerMinute: 60 };
function sendJSON(response, status, value, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}
function safeHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('cross-origin-opener-policy', 'same-origin');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}
function sameOrigin(request, publicOrigin) {
  const site = request.headers['sec-fetch-site'];
  if (site && !['same-origin', 'none'].includes(site)) return false;
  const origin = request.headers.origin;
  if (!origin) return true; // Non-browser clients are still rate/concurrency limited.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    return publicOrigin ? parsed.origin === new URL(publicOrigin).origin : parsed.host === request.headers.host;
  } catch { return false; }
}
async function readJSON(request, maxBytes) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) throw new APIError(400, 'INVALID_CONTENT_TYPE', 'Send an application/json request.');
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') throw new APIError(400, 'INVALID_ENCODING', 'Compressed request bodies are not supported.');
  const advertised = Number(request.headers['content-length']);
  if (Number.isFinite(advertised) && advertised > maxBytes) { request.resume(); throw new APIError(413, 'BODY_TOO_LARGE', 'The request body is too large.'); }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new APIError(413, 'BODY_TOO_LARGE', 'The request body is too large.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new APIError(400, 'INVALID_JSON', 'Send valid JSON.'); }
}
function rateKey(request, trustProxy) {
  if (trustProxy) {
    const last = request.headers['x-forwarded-for']?.split(',').at(-1)?.trim();
    if (last && isIP(last)) return last;
  }
  return request.socket.remoteAddress || 'unknown';
}

export function createAppServer({ aiService = createAIService(), publicDir = resolve(root, 'public'), limits = {}, publicOrigin = process.env.PUBLIC_ORIGIN,
  trustProxy = process.env.K_SERVICE !== undefined, now = Date.now } = {}) {
  const bounds = { ...defaultLimits, ...limits };
  for (const [key, value] of Object.entries(bounds)) if (!Number.isInteger(value) || value < 1) throw new Error(`Invalid server limit: ${key}`);
  const buckets = new Map();
  let active = 0;
  let globalBucket = { started: now(), count: 0 };
  function acquire(request) {
    const at = now();
    if (at - globalBucket.started >= 60000) globalBucket = { started: at, count: 0 };
    const key = rateKey(request, trustProxy);
    let bucket = buckets.get(key);
    if (!bucket || at - bucket.started >= 60000) { bucket = { started: at, count: 0 }; buckets.set(key, bucket); }
    if (buckets.size > 10000) {
      for (const [address, value] of buckets) if (at - value.started >= 60000) buckets.delete(address);
      if (buckets.size > 10000) buckets.delete(buckets.keys().next().value);
    }
    if (active >= bounds.maxConcurrent || bucket.count >= bounds.requestsPerMinute || globalBucket.count >= bounds.globalRequestsPerMinute) {
      throw new APIError(429, 'RATE_LIMITED', 'Too many requests. Please wait before trying again.');
    }
    bucket.count++; globalBucket.count++; active++;
  }
  const server = http.createServer(async (request, response) => {
    safeHeaders(response);
    let acquired = false;
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname === '/api/health' && request.method === 'GET') {
        const health = aiService.status();
        sendJSON(response, 200, { ok: true, aiConfigured: health.aiConfigured === true, provider: 'Google Gemini', model: typeof health.model === 'string' ? health.model : null });
        return;
      }
      if (url.pathname === '/api/organize' || url.pathname === '/api/ask') {
        if (request.method !== 'POST') { sendJSON(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this endpoint.' } }, { allow: 'POST' }); return; }
        if (!sameOrigin(request, publicOrigin)) throw new APIError(400, 'ORIGIN_NOT_ALLOWED', 'Use this application from the same origin.');
        acquire(request); acquired = true;
        const input = await readJSON(request, bounds.bodyBytes);
        const result = url.pathname === '/api/organize'
          ? await aiService.organize(validateOrganizeInput(input))
          : await aiService.ask(validateAskInput(input));
        sendJSON(response, 200, result);
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { sendJSON(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new APIError(400, 'INVALID_PATH', 'Invalid request path.'); }
      if (pathname.split('/').some(part => part.startsWith('.') || part.includes('\\')) || pathname.includes('\0')) { sendJSON(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }); return; }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!mimeTypes[extname(relative)]) { sendJSON(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }); return; }
      let data;
      try {
        const directory = await realpath(publicDir);
        const path = await realpath(resolve(directory, relative));
        if (!path.startsWith(directory + sep)) throw new Error('Outside public directory');
        data = await readFile(path);
      } catch { sendJSON(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }); return; }
      response.writeHead(200, { 'content-type': mimeTypes[extname(relative)], 'cache-control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const safe = error instanceof APIError ? error : new APIError(503, 'SERVICE_UNAVAILABLE', 'The service is unavailable. Your local memories have not been changed.');
      if (!response.headersSent && !response.destroyed) sendJSON(response, safe.status, { error: { code: safe.code, message: safe.message } }, safe.status === 429 ? { 'retry-after': '60' } : {});
      else if (!response.destroyed) response.end();
      // Intentionally no request, note, model response, credential, or upstream-error logging.
    } finally { if (acquired) active--; }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const server = createAppServer();
  server.listen(port, '0.0.0.0', () => console.log(`Starline Memory listening on port ${port}`));
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
