import http from 'node:http';

const PORT = process.env.PORT || 3000;

const routes = {
  '/': () => import('../api/index.js').then(m => m.default),
  '/login': () => import('../api/index.js').then(m => m.default),
  '/logout': () => import('../api/index.js').then(m => m.default),
  '/lead': () => import('../api/index.js').then(m => m.default),
  '/logs': () => import('../api/index.js').then(m => m.default),
  '/result': () => import('../api/index.js').then(m => m.default),
  '/api/login': () => import('../api/index.js').then(m => m.default),
  '/api/collect': () => import('../api/collect.js').then(m => m.default),
  '/api/dd-collect': () => import('../api/dd-collect.js').then(m => m.default),
  '/api/webhook': () => import('../api/webhook.js').then(m => m.default),
  '/api/sources': () => import('../api/sources/index.js').then(m => m.default),
  '/api/leads/export': () => import('../api/leads/export.js').then(m => m.default),
  '/api/leads': () => import('../api/leads/index.js').then(m => m.default),
  '/api/result-leads': () => import('../api/result-leads/index.js').then(m => m.default),
  '/api/logs': () => import('../api/logs/index.js').then(m => m.default),
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
    send(body) {
      realRes.writeHead(state.statusCode, {
        ...state.headers,
        'Content-Type': state.headers['content-type'] || 'text/html; charset=utf-8',
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
      handler: () => import('../api/sources/index.js').then(m => m.default),
      params: { id: m[1] },
    };
  }

  m = pathname.match(/^\/api\/schedules\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/schedules/index.js').then(m => m.default),
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

  m = pathname.match(/^\/api\/result-leads\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/result-leads/[id].js').then(m => m.default),
      params: { id: m[1] },
    };
  }

  m = pathname.match(/^\/api\/logs\/([^/]+)$/);
  if (m) {
    return {
      handler: () => import('../api/logs/index.js').then(m => m.default),
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
  console.log(`  /login               — Login page`);
  console.log(`  /                    — Config dashboard`);
  console.log(`  /lead                — Lead page`);
  console.log(`  /result              — Result leads page`);
  console.log(`  /logs                — Collect logs page`);
  console.log(`  POST /api/login      — Login (username/password from .env.local)`);
  console.log(`  GET /api/collect     — Trigger Apify`);
  console.log(`  POST /api/webhook    — Receive Apify results`);
  console.log(`  GET/POST /api/sources     — Manage sources`);
  console.log(`  GET/POST /api/schedules   — Manage cron schedules`);
  console.log(`  GET /api/cron-check       — Cron trigger`);
  console.log(`  GET/PATCH /api/leads      — List & batch update leads`);
  console.log(`  GET /api/leads/:id        — Lead detail`);
  console.log(`  GET /api/result-leads     — List result leads`);
  console.log(`  GET /api/leads/export     — Export CSV`);
});
