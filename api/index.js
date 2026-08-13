import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAuthenticated,
  clearCookie,
  verifyCredentials,
  sessionCookie,
} from '../src/lib/auth.js';

import collectHandler from '../src/routes/collect.js';
import cronCheckHandler from '../src/routes/cron-check.js';
import webhookHandler from '../src/routes/webhook.js';
import leadsHandler from '../src/routes/leads.js';
import leadHandler from '../src/routes/lead.js';
import leadsExportHandler from '../src/routes/leads-export.js';
import logsHandler from '../src/routes/logs.js';
import resultLeadsHandler from '../src/routes/result-leads.js';
import schedulesHandler from '../src/routes/schedules.js';
import sourcesHandler from '../src/routes/sources.js';

const API_ROUTES = {
  collect: collectHandler,
  'cron-check': cronCheckHandler,
  webhook: webhookHandler,
  leads: leadsHandler,
  lead: leadHandler,
  'leads-export': leadsExportHandler,
  logs: logsHandler,
  'result-leads': resultLeadsHandler,
  schedules: schedulesHandler,
  sources: sourcesHandler,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = path.join(__dirname, '..', 'scripts', 'test.html');
const LEAD_PATH = path.join(__dirname, '..', 'scripts', 'lead.html');
const LOGS_PATH = path.join(__dirname, '..', 'scripts', 'logs.html');
const RESULT_PATH = path.join(__dirname, '..', 'scripts', 'result.html');
const LOGIN_PATH = path.join(__dirname, '..', 'scripts', 'login.html');

function redirect(res, location) {
  res.setHeader('Location', location);
  res.status(302).end();
}

function sendPage(res, htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

function resolveRoute(url) {
  const explicit = url.searchParams.get('__route');
  if (explicit) return explicit;

  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return null;
  const segs = pathname.slice(5).replace(/^\/+/, '').split('/').filter(Boolean);
  if (segs.length === 0) return null;

  const head = segs[0];
  if (head === 'leads') {
    if (segs.length === 1) return 'leads';
    return segs[1] === 'export' ? 'leads-export' : 'lead';
  }
  if (head === 'logs') return 'logs';
  if (head === 'result-leads') return 'result-leads';
  if (head === 'schedules') return 'schedules';
  if (head === 'sources') return 'sources';
  if (['collect', 'cron-check', 'webhook'].includes(head)) return head;
  return null;
}

export default function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const view = url.searchParams.get('view');

  if (
    req.method === 'POST'
    && (pathname === '/api/login' || pathname.endsWith('/api/login') || url.searchParams.get('__login') === '1')
  ) {
    const { username = '', password = '' } = req.body || {};
    if (!verifyCredentials(username, password)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    res.setHeader('Set-Cookie', sessionCookie());
    return res.status(200).json({ ok: true });
  }

  if (pathname === '/login' || pathname.endsWith('/login') || view === 'login') {
    return sendPage(res, LOGIN_PATH);
  }

  if (pathname === '/logout' || pathname.endsWith('/logout') || view === 'logout') {
    res.setHeader('Set-Cookie', clearCookie());
    return redirect(res, '/login');
  }

  const route = resolveRoute(url);
  if (route) {
    const routeHandler = API_ROUTES[route];
    if (!routeHandler) {
      return res.status(404).json({ error: 'Unknown API route' });
    }
    return routeHandler(req, res);
  }

  if (pathname.startsWith('/api/')) {
    return res.status(404).json({ error: 'Unknown API route' });
  }

  if (!isAuthenticated(req)) {
    return redirect(res, '/login');
  }

  let htmlPath;
  if (pathname === '/logs' || pathname.endsWith('/logs') || view === 'logs') {
    htmlPath = LOGS_PATH;
  } else if (pathname === '/result' || pathname.endsWith('/result') || view === 'result') {
    htmlPath = RESULT_PATH;
  } else if (pathname === '/lead' || pathname.endsWith('/lead') || view === 'lead') {
    htmlPath = LEAD_PATH;
  } else {
    htmlPath = DASHBOARD_PATH;
  }

  return sendPage(res, htmlPath);
}
