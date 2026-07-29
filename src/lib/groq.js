const PROVIDERS = {
  groq: { baseURL: 'https://api.groq.com/openai/v1', jsonMode: true },
  typhoon: { baseURL: 'https://api.opentyphoon.ai/v1', jsonMode: false },
};

const SYSTEM_PROMPT = `You extract Thai property listing information from Facebook posts.

Return ONLY valid JSON. No markdown, no extra text.

Schema:
{
  "property_type": "บ้านเดี่ยว|ทาวน์เฮาส์|คอนโด|ที่ดิน|อาคารพาณิชย์|ห้องเช่า|อื่นๆ",
  "listing_status": "rent|sale|both",
  "rent_price": number or null,
  "sale_price": number or null,
  "land_area": "string or null",
  "building_area": "string or null",
  "province": "string or null",
  "district": "string or null",
  "sub_district": "string or null",
  "address": "string or null",
  "contact_name": "string or null",
  "phone_number": "string or null",
  "line_id": "string or null",
  "whatsapp": "string or null",
  "wechat": "string or null",
  "owner_or_agent": "owner|agent|unknown",
  "ai_summary": "1-2 sentence summary in Thai",
  "ai_tags": ["tag1","tag2"],
  "confidence_score": 0.0-1.0
}

If the post is not a property listing, set confidence_score to 0.`;

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

    if (res.ok) {
      const data = await res.json();
      try {
        return JSON.parse(data.choices[0].message.content);
      } catch {
        return { confidence_score: 0, raw: data.choices[0].message.content };
      }
    }

    if (res.status === 429 && attempt < maxRetries - 1) {
      console.warn(`${providerName}: rate limited, retrying in 5s... (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(5000);
      continue;
    }

    throw new Error(`${providerName} API error (${res.status}): ${await res.text()}`);
  }

  throw new Error(`${providerName}: max retries exceeded`);
}
