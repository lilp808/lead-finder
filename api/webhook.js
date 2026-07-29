import { getDatasetItems } from '../src/lib/apify.js';
import { extractProperty } from '../src/lib/groq.js';
import {
  getClient,
  downloadAndUploadImages,
  insertLead,
} from '../src/lib/supabase.js';

export default async function handler(req, res) {
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

  const apifyGroupUrl = req.body?.webhook?.data?.groupUrl || '';

  const supabase = getClient();
  const results = [];

  for (const item of items) {
    const postUrl = item.url || item.postUrl;
    if (!postUrl) continue;

    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('post_url', postUrl)
      .maybeSingle();

    if (existing) {
      results.push({ postUrl, status: 'duplicate' });
      continue;
    }

    const extraction = await extractProperty(item.text || '');
    if ((extraction.confidence_score ?? 0) < 0.3) {
      results.push({ postUrl, status: 'low_confidence', score: extraction.confidence_score });
      continue;
    }

    const leadId = crypto.randomUUID();
    const imageUrls = await downloadAndUploadImages(leadId, item.imageUrls || []);

    const lead = {
      id: leadId,
      post_url: postUrl,
      group_url: item.groupUrl || apifyGroupUrl,
      author_name: item.authorName,
      author_url: item.authorUrl,
      posted_at: item.date || item.createdAt || null,
      property_type: extraction.property_type,
      listing_status: extraction.listing_status,
      rent_price: extraction.rent_price,
      sale_price: extraction.sale_price,
      land_area: extraction.land_area,
      building_area: extraction.building_area,
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
      raw_post_text: item.text,
      ai_summary: extraction.ai_summary,
      ai_tags: extraction.ai_tags,
      confidence_score: extraction.confidence_score,
      lead_score: extraction.lead_score ?? null,
    };

    const inserted = await insertLead(lead);
    results.push({ postUrl, status: 'inserted', leadId: inserted.id });
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
}
