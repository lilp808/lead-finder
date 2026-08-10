import { verifyCredentials, sessionCookie } from '../src/lib/auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username = '', password = '' } = req.body || {};

  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  res.setHeader('Set-Cookie', sessionCookie());
  return res.status(200).json({ ok: true });
}