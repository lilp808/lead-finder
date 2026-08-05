import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = path.join(__dirname, '..', 'scripts', 'test.html');
const LEAD_PATH = path.join(__dirname, '..', 'scripts', 'lead.html');

export default function handler(req, res) {
  const pathname = (req.url || '').split('?')[0];
  const isLead = pathname === '/lead' || pathname.endsWith('/lead');

  const html = fs.readFileSync(isLead ? LEAD_PATH : DASHBOARD_PATH, 'utf-8');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}