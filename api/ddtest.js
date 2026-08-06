import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import axios from 'axios';

const execFileAsync = promisify(execFile);

const TEST_URL = process.env.DD_TEST_URL || 'https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"';

function classify(html) {
  if (!html) return 'empty';
  if (html.includes('Just a moment...')) return 'cloudflare_challenge';
  if (html.includes('__NEXT_DATA__')) return 'OK_has_data';
  if (html.length < 200) return `tiny_${html.length}b`;
  return 'other_html';
}

async function tryCurl() {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-L', '--http1.1', '-sS',
      '-A', UA,
      '-H', `sec-ch-ua: ${SEC_CH_UA}`,
      '-H', 'Accept: text/html',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      TEST_URL,
    ], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, size: stdout.length, classification: classify(stdout), first: stdout.slice(0, 60) };
  } catch (err) {
    return { ok: false, code: err.code, message: err.message.slice(0, 200) };
  }
}

async function tryUndici() {
  try {
    const res = await fetch(TEST_URL, {
      headers: { 'User-Agent': UA, 'sec-ch-ua': SEC_CH_UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    return { ok: true, status: res.status, size: text.length, classification: classify(text), first: text.slice(0, 60) };
  } catch (err) {
    return { ok: false, code: err.cause?.code || err.code, message: err.message.slice(0, 200) };
  }
}

async function tryAxios() {
  try {
    const res = await axios.get(TEST_URL, {
      timeout: 30000,
      maxContentLength: 20 * 1024 * 1024,
      headers: { 'User-Agent': UA, 'sec-ch-ua': SEC_CH_UA, 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return { ok: true, status: res.status, size: text.length, classification: classify(text), first: text.slice(0, 60) };
  } catch (err) {
    return { ok: false, code: err.code, message: (err.message || '').slice(0, 200) };
  }
}

async function probeUndici(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(25000),
    });
    let body = '';
    try { body = await res.text(); } catch {}
    return { ok: true, status: res.status, size: body.length, classification: classify(body), first: body.slice(0, 80) };
  } catch (err) {
    return { ok: false, code: err.cause?.code || err.code || err.name, message: (err.message || '').slice(0, 160) };
  }
}

async function probeAxios(url) {
  try {
    const res = await axios.get(url, { timeout: 25000, maxContentLength: 20 * 1024 * 1024, headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9' } });
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    return { ok: true, status: res.status, size: text.length, classification: classify(text), first: text.slice(0, 80) };
  } catch (err) {
    return { ok: false, code: err.code || err.name, status: err.response?.status, message: (err.message || '').slice(0, 160) };
  }
}

export default async function handler(req, res) {
  const bid = 'consumerweb-search-aba73f1a84';
  const hosts = [
    'https://search-api.propertyguru.com',
    'https://api-www.propertyguru.com',
    'https://www.propertyguru.com.sg/api',
    'https://api.propertyguru.com.sg/apigateway/property/sg/1/listing/list',
    `https://www.ddproperty.com/_next/data/${bid}/en/property-for-rent.json?listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true&locale=th&page=1`,
    'https://www.ddproperty.com/api/listing/search?listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true&page=1',
  ];
  const probes = {};
  for (const h of hosts) {
    probes[h] = { undici: await probeUndici(h), axios: await probeAxios(h) };
  }
  return res.status(200).json({ at: new Date().toISOString(), node: process.version, probes });
}
