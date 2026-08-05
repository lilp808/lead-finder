import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'test.html'), 'utf-8');
const leadHtml = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lead.html'), 'utf-8');

export default function handler(req, res) {
  const pathname = (req.url || '').split('?')[0];
  const isLead = pathname === '/lead' || pathname.endsWith('/lead');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(isLead ? leadHtml : dashboardHtml);
}