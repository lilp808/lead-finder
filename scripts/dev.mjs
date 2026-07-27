import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'test.html'), 'utf-8');

const ROOT = Symbol('root');

const routes = {
  '/': ROOT,
  '/api/collect': () => import('../api/collect.js').then(m => m.default),
  '/api/webhook': () => import('../api/webhook.js').then(m => m.default),
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const loadHandler = routes[url.pathname];

  if (loadHandler === undefined) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }

  if (loadHandler === ROOT) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  const handler = await loadHandler();

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
  console.log(`  /              — Test dashboard`);
  console.log(`  GET /api/collect  — Trigger Apify`);
  console.log(`  POST /api/webhook — Receive Apify results`);
});
