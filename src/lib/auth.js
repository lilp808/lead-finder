import crypto from 'node:crypto';

const COOKIE_NAME = 'fp_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getCredentials() {
  return {
    username: process.env.LOGIN_USERNAME || '',
    password: process.env.LOGIN_PASSWORD || '',
  };
}

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return crypto.createHash('sha256').update(getCredentials().password).digest('hex');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function verifyCredentials(username, password) {
  const { username: envUser, password: envPass } = getCredentials();
  if (!envUser || !envPass) return false;
  return safeEqual(username, envUser) && safeEqual(password, envPass);
}

function padTs(ts) {
  return String(ts).padStart(16, '0');
}

export function issueToken() {
  const { username } = getCredentials();
  const ts = padTs(Date.now());
  const sig = crypto.createHmac('sha256', getSecret()).update(`${username}:${ts}`).digest('base64url');
  return `${Buffer.from(ts).toString('base64url')}.${sig}`;
}

export function verifyToken(token) {
  if (!token) return false;
  const [tsEnc, sig] = token.split('.');
  if (!tsEnc || !sig) return false;
  const ts = Buffer.from(tsEnc, 'base64url').toString();
  if (!/^\d{16}$/.test(ts)) return false;

  const { username } = getCredentials();
  const expected = crypto.createHmac('sha256', getSecret()).update(`${username}:${ts}`).digest('base64url');
  if (!safeEqual(sig, expected)) return false;

  const issuedAt = parseInt(ts, 10);
  if (Number.isNaN(issuedAt)) return false;
  return Date.now() - issuedAt <= SESSION_TTL_MS;
}

export function readCookie(req, name) {
  const header = req.headers.cookie || req.headers.Cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export function isAuthenticated(req) {
  if (!getCredentials().username || !getCredentials().password) return false;
  return verifyToken(readCookie(req, COOKIE_NAME));
}

export function sessionCookie() {
  return [
    `${COOKIE_NAME}=${issueToken()}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=604800',
  ].join('; ');
}

export function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}