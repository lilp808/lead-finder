import { readFileSync } from 'node:fs';
import { computePrices } from './pricing.js';

const PROVIDERS = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', jsonMode: true },
  typhoon: { baseURL: 'https://api.opentyphoon.ai/v1', jsonMode: false },
};

const SYSTEM_PROMPT = readFileSync(
  new URL('./prompts/extract-property.md', import.meta.url),
  'utf8',
).trim();

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function extractProperty(postText, options = {}) {
  if (!postText || postText.trim().length < 10) {
    return { confidence_score: 0 };
  }

  const providerName = options.provider || 'typhoon';
  const modelName = options.model || 'typhoon-v2.5-30b-a3b-instruct';
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}. Use 'groq' or 'typhoon'.`);
  }

  const apiKey = providerName === 'groq'
    ? process.env.GROQ_API_KEY
    : process.env.TYPHOON_API_KEY;

  if (!apiKey) {
    throw new Error(`Missing ${providerName.toUpperCase()}_API_KEY in env`);
  }

  const body = {
    model: modelName,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: postText.slice(0, 4000) },
    ],
    temperature: 0.1,
  };

  if (provider.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(`${provider.baseURL}/chat/completions`, {
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
        console.warn(`${providerName}: API ${res.status}, retrying in 5s... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(5000);
        continue;
      }
      throw new Error(`${providerName} API error (${res.status}): ${text.slice(0, 200)}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (attempt < maxRetries - 1) {
        console.warn(`${providerName}: non-JSON response, retrying in 5s... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(5000);
        continue;
      }
      return { confidence_score: 0, raw: text.slice(0, 200) };
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { confidence_score: 0 };
    }

    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { confidence_score: 0, raw: content.slice(0, 200) };
      }
      return { ...parsed, ...computePrices(parsed) };
    } catch {
      return { confidence_score: 0, raw: content.slice(0, 200) };
    }
  }

  throw new Error(`${providerName}: max retries exceeded`);
}
