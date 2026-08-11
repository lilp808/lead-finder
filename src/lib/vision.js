import { readFileSync } from 'node:fs';

const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';
const MAX_IMAGES = 4; // Groq vision allows up to 5 per request; keep 4 (2 per set)
const MAX_IMAGES_PER_SET = 2;

const SYSTEM_PROMPT = readFileSync(
  new URL('./prompts/compare-properties.md', import.meta.url),
  'utf8',
).trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickImages(urls, count) {
  if (!Array.isArray(urls)) return [];
  const candidates = urls.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
  return candidates.slice(0, count);
}

export async function comparePropertyImages(imageUrlsA, imageUrlsB, options = {}) {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY in env — cannot verify duplicate with vision');
  }

  const imagesA = pickImages(imageUrlsA, MAX_IMAGES_PER_SET);
  const imagesB = pickImages(imageUrlsB, MAX_IMAGES_PER_SET);
  if (imagesA.length === 0 || imagesB.length === 0) {
    throw new Error('Need at least one image URL from each side to compare');
  }

  const content = [
    { type: 'text', text: 'These are the photos of two property listings.' },
  ];
  for (const url of imagesA) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  content.push({ type: 'text', text: '--- END OF LISTING A. LISTING B BELOW ---' });
  for (const url of imagesB) {
    content.push({ type: 'image_url', image_url: { url } });
  }
  content.push({ type: 'text', text: 'Are listing A and listing B the same physical property?' });

  const body = {
    model: options.model || VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  };

  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < maxRetries - 1) {
        console.warn(`vision: API ${res.status}, retrying in 5s... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(5000);
        continue;
      }
      throw new Error(`vision API error (${res.status}): ${text.slice(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (attempt < maxRetries - 1) {
        console.warn('vision: non-JSON response, retrying in 5s...');
        await sleep(5000);
        continue;
      }
      throw new Error('vision: non-JSON response');
    }

    const contentText = data?.choices?.[0]?.message?.content;
    if (!contentText) throw new Error('vision: empty response content');

    try {
      const parsed = JSON.parse(contentText);
      if (!parsed || typeof parsed !== 'object') throw new Error('vision: bad JSON shape');
      return {
        same_place: parsed.same_place === true,
        confidence: Number(parsed.confidence) || 0,
        reason: parsed.reason || '',
        model: options.model || VISION_MODEL,
      };
    } catch {
      throw new Error('vision: could not parse JSON from model');
    }
  }

  throw new Error('vision: max retries exceeded');
}
