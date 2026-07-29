import { startActorRun, getDatasetItems } from '../src/lib/apify.js';
import { extractProperty } from '../src/lib/groq.js';
import {
  getClient,
  downloadAndUploadImages,
  insertLead,
} from '../src/lib/supabase.js';

const APIFY_BASE = 'https://api.apify.com/v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mapApifyItem(item) {
  const imageUrls = (item.attachments || [])
    .filter(a => a.__typename === 'Photo' && a.image?.uri)
    .map(a => a.image.uri);
  return {
    url: item.url,
    text: item.text,
    imageUrls,
    authorName: item.user?.name || '',
    authorUrl: item.user?.profilePic || '',
    createdAt: item.time || null,
    groupUrl: item.inputUrl || item.facebookUrl || '',
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.APIFY_API_KEY) {
      return res.status(500).json({ error: 'Missing APIFY_API_KEY in env' });
    }

    const groups = JSON.parse(process.env.GROUP_URLS || '[]');
    if (groups.length === 0) {
      return res.status(400).json({ error: 'No GROUP_URLS configured' });
    }

    const limit = parseInt(req.query?.limit) || 5;
    const steps = [];

    const runResult = await startActorRun(groups[0], null, limit);
    const runId = runResult.data.id;
    steps.push({ type: 'run_start', status: 'ok', runId });

    let pollStatus = 'READY';
    let pollElapsed = 0;
    let datasetId = null;

    while (pollStatus === 'READY' || pollStatus === 'RUNNING') {
      const pollRes = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${process.env.APIFY_API_KEY}`,
      );
      if (!pollRes.ok) throw new Error(`Poll failed (${pollRes.status})`);
      const pollData = await pollRes.json();
      pollStatus = pollData.data.status;

      if (pollStatus === 'SUCCEEDED') {
        datasetId = pollData.data.defaultDatasetId;
        steps.push({ type: 'poll', status: 'ok', elapsed: pollElapsed });
        break;
      }
      if (pollStatus === 'FAILED' || pollStatus === 'ABORTED') {
        throw new Error(`Apify run ${pollStatus}`);
      }

      pollElapsed += 3;
      steps.push({ type: 'poll', status: 'running', elapsed: pollElapsed });
      await sleep(3000);
    }

    if (!datasetId) throw new Error('No dataset produced');

    const rawItems = await getDatasetItems(datasetId);
    const items = (Array.isArray(rawItems) ? rawItems : []).map(mapApifyItem);
    steps.push({ type: 'fetch', status: 'ok', count: items.length });

    const supabase = getClient();
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const postUrl = item.url;
      if (!postUrl) continue;

      steps.push({ type: 'item_progress', status: 'processing', index: i + 1, total: items.length });

      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('post_url', postUrl)
        .maybeSingle();

      if (existing) {
        results.push({ postUrl, status: 'duplicate' });
        steps.push({ type: 'item', status: 'duplicate', postUrl: postUrl.slice(0, 80) });
        continue;
      }

      const extraction = await extractProperty(item.text || '');

      if ((extraction.confidence_score ?? 0) < 0.3) {
        results.push({ postUrl, status: 'low_confidence', score: extraction.confidence_score });
        steps.push({ type: 'item', status: 'low_confidence', postUrl: postUrl.slice(0, 80), score: extraction.confidence_score });
        continue;
      }

      const leadId = crypto.randomUUID();
      let imageUrls = [];
      try {
        imageUrls = await downloadAndUploadImages(leadId, item.imageUrls);
      } catch (err) {
        console.error('Image upload failed:', err.message);
      }

      const lead = {
        id: leadId,
        post_url: postUrl,
        group_url: item.groupUrl,
        author_name: item.authorName,
        author_url: item.authorUrl,
        posted_at: item.createdAt,
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

      try {
        const inserted = await insertLead(lead);
        results.push({ postUrl, status: 'inserted', leadId: inserted.id });
        steps.push({ type: 'item', status: 'inserted', property_type: extraction.property_type, confidence: extraction.confidence_score, postUrl: postUrl.slice(0, 80) });
      } catch (err) {
        results.push({ postUrl, status: 'error', error: err.message });
        steps.push({ type: 'item', status: 'error', error: err.message });
      }
    }

    const summary = {
      inserted: results.filter(r => r.status === 'inserted').length,
      duplicates: results.filter(r => r.status === 'duplicate').length,
      low_confidence: results.filter(r => r.status === 'low_confidence').length,
      errors: results.filter(r => r.status === 'error').length,
    };
    steps.push({ type: 'summary', ...summary });

    return res.status(200).json({ ok: true, steps, summary });
  } catch (err) {
    console.error('Collect error:', err);
    return res.status(500).json({ ok: false, steps: [{ type: 'error', status: 'error', message: err.message }] });
  }
}
