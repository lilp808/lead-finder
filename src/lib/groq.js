const GROQ_BASE = 'https://api.groq.com/openai/v1';

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

export async function extractProperty(postText) {
  if (!postText || postText.trim().length < 10) {
    return { confidence_score: 0 };
  }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: postText.slice(0, 4000) },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
