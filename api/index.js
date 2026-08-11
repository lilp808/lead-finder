import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isAuthenticated,
  clearCookie,
  verifyCredentials,
  sessionCookie,
} from '../src/lib/auth.js';

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

function sendPage(res, htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}