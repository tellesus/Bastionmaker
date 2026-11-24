// Bastionmaker API. Storage is D1: one row per campaign, one per bastion.
// Static files in ./public are served by the assets binding when the Worker is deployed with
// wrangler. Without that binding, they are fetched from ASSETS_ORIGIN (the public/ folder of the
// GitHub repository) and cached at the edge, so a push to the repository updates the site.

const MAX_BODY = 400_000;
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status, error) => json({ error }, status);

function newId(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

let schemaReady;
function ensureSchema(db) {
  schemaReady ??= db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS bastions (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, summary TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS bastions_campaign ON bastions (campaign_id)'),
  ]).catch((e) => { schemaReady = undefined; throw e; });
  return schemaReady;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'Too large');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON'); }
}
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const cleanName = (s, fallback) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 80) : fallback);
const cleanSummary = (s) => JSON.stringify(s && typeof s === 'object' ? s : {}).slice(0, 4000);

async function api(request, env, url) {
  const db = env.DB;
  await ensureSchema(db);
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
  const method = request.method;
  const now = Date.now();

  if (parts[0] !== 'campaigns') throw new HttpError(404, 'Not found');

  // POST /api/campaigns
  if (parts.length === 1 && method === 'POST') {
    const body = await readBody(request);
    const id = newId(12);
    const name = cleanName(body.name, 'Our Campaign');
    await db.prepare('INSERT INTO campaigns (id, name, created_at) VALUES (?, ?, ?)').bind(id, name, now).run();
    return json({ id, name }, 201);
  }

  const cid = parts[1];
  const campaign = cid && (await db.prepare('SELECT id, name FROM campaigns WHERE id = ?').bind(cid).first());
  if (!campaign) throw new HttpError(404, 'Campaign not found');

  // GET /api/campaigns/:cid
  if (parts.length === 2 && method === 'GET') {
    const { results } = await db.prepare('SELECT id, summary, version, updated_at FROM bastions WHERE campaign_id = ? ORDER BY updated_at DESC').bind(cid).all();
    return json({ ...campaign, bastions: results.map((r) => ({ id: r.id, version: r.version, updatedAt: r.updated_at, summary: JSON.parse(r.summary) })) });
  }
  // PUT /api/campaigns/:cid  (rename)
  if (parts.length === 2 && method === 'PUT') {
    const body = await readBody(request);
    const name = cleanName(body.name, campaign.name);
    await db.prepare('UPDATE campaigns SET name = ? WHERE id = ?').bind(name, cid).run();
    return json({ id: cid, name });
  }

  if (parts[2] !== 'bastions') throw new HttpError(404, 'Not found');

  // POST /api/campaigns/:cid/bastions
  if (parts.length === 3 && method === 'POST') {
    const body = await readBody(request);
    if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'Missing data');
    const id = newId(10);
    await db.prepare('INSERT INTO bastions (id, campaign_id, summary, data, version, updated_at) VALUES (?, ?, ?, ?, 1, ?)')
      .bind(id, cid, cleanSummary(body.summary), JSON.stringify(body.data), now).run();
    return json({ id, version: 1 }, 201);
  }

  const bid = parts[3];
  if (!bid || parts.length !== 4) throw new HttpError(404, 'Not found');

  if (method === 'GET') {
    const row = await db.prepare('SELECT data, version, updated_at FROM bastions WHERE id = ? AND campaign_id = ?').bind(bid, cid).first();
    if (!row) throw new HttpError(404, 'Bastion not found');
    return json({ id: bid, version: row.version, updatedAt: row.updated_at, data: JSON.parse(row.data), campaign });
  }
  if (method === 'PUT') {
    const body = await readBody(request);
    if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'Missing data');
    // Optimistic concurrency: only write if the caller saw the latest version.
    const res = await db.prepare('UPDATE bastions SET summary = ?, data = ?, version = version + 1, updated_at = ? WHERE id = ? AND campaign_id = ? AND version = ?')
      .bind(cleanSummary(body.summary), JSON.stringify(body.data), now, bid, cid, Number(body.version) || 0).run();
    if (!res.meta.changes) {
      const row = await db.prepare('SELECT version FROM bastions WHERE id = ? AND campaign_id = ?').bind(bid, cid).first();
      if (!row) throw new HttpError(404, 'Bastion not found');
      return json({ error: 'This bastion was changed somewhere else.', version: row.version }, 409);
    }
    return json({ id: bid, version: (Number(body.version) || 0) + 1 });
  }
  if (method === 'DELETE') {
    await db.prepare('DELETE FROM bastions WHERE id = ? AND campaign_id = ?').bind(bid, cid).run();
    return json({ ok: true });
  }
  throw new HttpError(405, 'Method not allowed');
}

const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon' };

async function fromOrigin(request, env, ctx, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  if (!env.ASSETS_ORIGIN) return new Response('No static assets configured', { status: 500 });
  const path = url.pathname === '/' ? '/index.html' : url.pathname;
  const ext = path.split('.').pop();
  if (!/^[\w\-./]+$/.test(path) || path.includes('..') || !TYPES[ext]) return new Response('Not found', { status: 404 });
  const cacheKey = new Request(url.origin + path);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;
  const upstream = await fetch(env.ASSETS_ORIGIN + path, { cf: { cacheTtl: 120 } });
  if (!upstream.ok) return new Response('Not found', { status: upstream.status === 404 ? 404 : 502 });
  const res = new Response(upstream.body, { headers: { 'content-type': TYPES[ext], 'cache-control': 'public, max-age=120', 'x-content-type-options': 'nosniff' } });
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : fromOrigin(request, env, ctx, url);
    try {
      return await api(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error(e);
      return fail(500, 'Server error');
    }
  },
};
