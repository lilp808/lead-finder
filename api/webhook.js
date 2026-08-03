import { getDatasetItems } from '../src/lib/apify.js';
import { extractProperty } from '../src/lib/groq.js';
import {
  getClient,
  downloadAndUploadImages,
  insertLead,
} from '../src/lib/supabase.js';

const BATCH_SIZE = 5;
const TIME_LIMIT_SEC = 55;

async function processOneItem(item, sourceUrl, supabase, modelOptions = {}) {
  const postUrl = item.url || item.postUrl;
  if (!postUrl) return null;

  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('post_url', postUrl)
    .maybeSingle();

  if (existing) {
    return { postUrl, status: 'duplicate' };
  }

  const extraction = await extractProperty(item.text || '', modelOptions);

  if ((extraction.confidence_score ?? 0) < 0.3) {
    return { postUrl, status: 'low_confidence', score: extraction.confidence_score };
  }

  const leadId = crypto.randomUUID();
  let imageUrls = [];
  try {
    imageUrls = await downloadAndUploadImages(leadId, item.imageUrls || []);
  } catch (err) {
    console.error('Image upload failed:', err.message);
  }

  const lead = {
    id: leadId,
    post_url: postUrl,
    source_url: sourceUrl,
    source_platform: 'facebook',
    author_name: item.authorName,
    author_url: item.authorUrl,
    posted_at: item.date || item.createdAt || null,
    property_type: extraction.property_type,
    listing_status: extraction.listing_status,
    rent_price: extraction.rent_price,
    sale_price: extraction.sale_price,
    rent_price_raw: extraction.rent_price_raw,
    sale_price_raw: extraction.sale_price_raw,
    rent_price_unit: extraction.rent_price_unit,
    sale_price_unit: extraction.sale_price_unit,
    pricing_area_sqm: extraction.pricing_area_sqm,
    land_area: extraction.land_area,
    land_area_sqm: extraction.land_area_sqm,
    building_area: extraction.building_area,
    building_area_sqm: extraction.building_area_sqm,
    province: extraction.province,
    district: extraction.district,
    sub_district: extraction.sub_district,
    address: extraction.address,
    contact_name: extraction.contact_name,
    phone_number: extraction.phone_number,
    line_id: extraction.line_id,
    whatsapp: extraction.whatsapp,
    wechat: extraction.wechat,
    owner_or_agent: extraction.owner_or_agent,
    image_urls: imageUrls,
    screenshot_urls: [],
    raw_post_text: item.text,
    ai_summary: extraction.ai_summary,
    ai_tags: extraction.ai_tags,
    confidence_score: extraction.confidence_score,
    lead_score: extraction.lead_score ?? null,
  };

  try {
    const inserted = await insertLead(lead);
    return { postUrl, status: 'inserted', leadId: inserted.id };
  } catch (err) {
    if (err.message?.includes('duplicate key') || err.code === '23505') {
      return { postUrl, status: 'duplicate' };
    }
    return { postUrl, status: 'error', error: err.message };
  }
}

async function processItems(items, sourceUrl, supabase, modelOptions = {}) {
  const startTime = Date.now();
  const results = [];
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > TIME_LIMIT_SEC) {
      skipped = items.length - i;
      break;
    }

    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(item => processOneItem(item, sourceUrl, supabase, modelOptions).catch(err => ({
        postUrl: item.url || item.postUrl,
        status: 'error',
        error: err.message,
      })))
    );

    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return { results, skipped };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      const raw = await new Promise(resolve => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
      });
      req.body = raw ? JSON.parse(raw) : {};
    }

    const { eventType, resource } = req.body;

    if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
      return res.status(200).json({ ok: true, message: 'ignored' });
    }

    const mockItems = req.body?._mockItems;

    if (!mockItems && !resource?.defaultDatasetId) {
      return res.status(200).json({ ok: true, message: 'no dataset' });
    }

    const items = mockItems || await getDatasetItems(resource.defaultDatasetId);
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({ ok: true, message: 'no items' });
    }

    const sourceUrl = req.body?.webhook?.data?.groupUrl || '';

    const supabase = getClient();
    const { results, skipped } = await processItems(items, sourceUrl, supabase);

    return res.status(200).json({
      ok: true,
      processed: results.length,
      skipped,
      results,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
