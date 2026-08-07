import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = path.join(__dirname, '..', 'scripts', 'test.html');
const LEAD_PATH = path.join(__dirname, '..', 'scripts', 'lead.html');
const LOGS_PATH = path.join(__dirname, '..', 'scripts', 'logs.html');

export default function handler(req, res) {
  const pathname = (req.url || '').split('?')[0];
  let htmlPath;
  if (pathname === '/logs' || pathname.endsWith('/logs')) {
    htmlPath = LOGS_PATH;
  } else if (pathname === '/lead' || pathname.endsWith('/lead')) {
    htmlPath = LEAD_PATH;
  } else {
    htmlPath = DASHBOARD_PATH;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}