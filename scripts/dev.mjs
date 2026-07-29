import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'test.html'), 'utf-8');
const leadHtml = fs.readFileSync(path.join(__dirname, 'lead.html'), 'utf-8');

const ROOT = Symbol('root');

const LEAD = Symbol('lead');

const routes = {
  '/': ROOT,
  '/lead': LEAD,
  '/api/collect': () => import('../api/collect.js').then(m => m.default),
  '/api/webhook': () => import('../api/webhook.js').then(m => m.default),
  '/api/sources': () => import('../api/sources/index.js').then(m => m.default),
  '/api/leads/export': () => import('../api/leads/export.js').then(m => m.default),
  '/api/leads': () => import('../api/leads/index.js').then(m => m.default),
  '/api/cron-check': () => import('../api/cron-check.js').then(m => m.default),
  '/api/schedules': () => import('../api/schedules/index.js').then(m => m.default),
};

function createMockRes(realRes) {
  const state = { statusCode: 200, headers: {} };
  return {
    status(code) { state.statusCode = code; return this; },
    setHeader(key, val) { state.headers[key.toLowerCase()] = val; },
    json(data) {
      realRes.writeHead(state.statusCode, {
        ...state.headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      realRes.end(JSON.stringify(data));
    },
    end(body) {
      if (typeof body !== 'string') body = JSON.stringify(body);
      realRes.writeHead(state.statusCode, {
        ...state.headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      realRes.end(body);
    },
  };
}

function matchRoute(pathname) {
  if (routes[pathname]) return { handler: routes[pathname], params: {} };

  let m;

  m = pathname.match(/^\/api\/sources\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/sources/[id].js').then(m => m.default),
      params: { id: m[1] },
    };
  }

  m = pathname.match(/^\/api\/schedules\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/schedules/[id].js').then(m => m.default),
      params: { id: m[1] },
    };
  }

  m = pathname.match(/^\/api\/leads\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/leads/[id].js').then(m => m.default),
      params: { id: m[1] },
    };
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = matchRoute(url.pathname);

  if (match === null) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }

  if (match.handler === ROOT) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (match.handler === LEAD) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(leadHtml);
  }

  const handler = await match.handler();

  const body = await new Promise(resolve => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });

  try {
    req.body = body ? JSON.parse(body) : {};
  } catch {
    req.body = {};
  }

  req.query = { ...Object.fromEntries(url.searchParams.entries()), ...match.params };

  const mockRes = createMockRes(res);

  try {
    await handler(req, mockRes);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}`);
  console.log(`  /                    — Config dashboard`);
  console.log(`  /lead                — Lead page`);
  console.log(`  GET /api/collect     — Trigger Apify`);
  console.log(`  POST /api/webhook    — Receive Apify results`);
  console.log(`  GET/POST /api/sources     — Manage sources`);
  console.log(`  GET/POST /api/schedules   — Manage cron schedules`);
  console.log(`  GET /api/cron-check       — Cron trigger`);
  console.log(`  GET/PATCH /api/leads      — List & batch update leads`);
  console.log(`  GET /api/leads/:id        — Lead detail`);
  console.log(`  GET /api/leads/export     — Export CSV`);
});
