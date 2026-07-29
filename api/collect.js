import { startActorRun, getDatasetItems } from '../src/lib/apify.js';
import { extractProperty } from '../src/lib/groq.js';
import {
  getClient,
  downloadAndUploadImages,
  insertLead,
} from '../src/lib/supabase.js';

const APIFY_BASE = 'https://api.apify.com/v2';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BATCH_SIZE = 5;
const TIME_LIMIT_SEC = 50;

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

async function processOneItem(item, sourceUrl, supabase, modelOptions = {}) {
  const postUrl = item.url;
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
    imageUrls = await downloadAndUploadImages(leadId, item.imageUrls);
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
    screenshot_urls: [],
    raw_post_text: item.text,
    ai_summary: extraction.ai_summary,
    ai_tags: extraction.ai_tags,
    confidence_score: extraction.confidence_score,
    lead_score: extraction.lead_score ?? null,
  };

  try {
    const inserted = await insertLead(lead);
    return { postUrl, status: 'inserted', leadId: inserted.id, property_type: extraction.property_type, confidence: extraction.confidence_score };
  } catch (err) {
    if (err.message?.includes('duplicate key') || err.code === '23505') {
      return { postUrl, status: 'duplicate' };
    }
    return { postUrl, status: 'error', error: err.message };
  }
}

async function processItems(items, sourceUrl, supabase, steps, modelOptions = {}) {
  const startTime = Date.now();
  const results = [];
  let skipped = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > TIME_LIMIT_SEC) {
      skipped = items.length - i;
      steps.push({ type: 'time_limit', status: 'warning', processed: results.length, skipped });
      break;
    }

    const batch = items.slice(i, i + BATCH_SIZE);
    steps.push({ type: 'batch_progress', status: 'processing', batch: Math.floor(i / BATCH_SIZE) + 1, total: Math.ceil(items.length / BATCH_SIZE) });

    const batchResults = await Promise.all(
      batch.map(item => processOneItem(item, sourceUrl, supabase, modelOptions))
    );

    for (const r of batchResults) {
      if (!r) continue;
      results.push(r);
      if (r.status === 'inserted') {
        steps.push({ type: 'item', status: 'inserted', property_type: r.property_type, confidence: r.confidence, postUrl: (r.postUrl || '').slice(0, 80) });
      } else if (r.status === 'duplicate') {
        steps.push({ type: 'item', status: 'duplicate', postUrl: (r.postUrl || '').slice(0, 80) });
      } else if (r.status === 'low_confidence') {
        steps.push({ type: 'item', status: 'low_confidence', score: r.score, postUrl: (r.postUrl || '').slice(0, 80) });
      } else if (r.status === 'error') {
        steps.push({ type: 'item', status: 'error', error: r.error });
      }
    }
  }

  return { results, skipped };
}

async function processSource(source, steps) {
  const { source_url, results_limit, label } = source;
  const limit = results_limit || 5;

  steps.push({ type: 'source_start', status: 'ok', label, limit });

  const runResult = await startActorRun(source_url, null, limit);
  const runId = runResult.data.id;

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
      steps.push({ type: 'poll', status: 'ok', elapsed: pollElapsed, label });
      break;
    }
    if (pollStatus === 'FAILED' || pollStatus === 'ABORTED') {
      throw new Error(`Apify run ${pollStatus} for ${label}`);
    }

    pollElapsed += 3;
    steps.push({ type: 'poll', status: 'running', elapsed: pollElapsed, label });
    await sleep(3000);
  }

  if (!datasetId) throw new Error(`No dataset produced for ${label}`);

  const rawItems = await getDatasetItems(datasetId);
  return (Array.isArray(rawItems) ? rawItems : []).map(mapApifyItem);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.APIFY_API_KEY) {
      return res.status(500).json({ error: 'Missing APIFY_API_KEY in env' });
    }

    const supabase = getClient();

    const { data: sources, error: sourcesError } = await supabase
      .from('source_configs')
      .select('*')
      .eq('active', true)
      .eq('platform', 'facebook');

    if (sourcesError) {
      throw new Error(`Failed to load sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      return res.status(400).json({ error: 'No active Facebook sources configured. Add one in Sources settings.' });
    }

    const steps = [];
    const allResults = [];
    let totalSkipped = 0;

    for (const source of sources) {
      try {
        const items = await processSource(source, steps);
        steps.push({ type: 'fetch', status: 'ok', count: items.length, label: source.label });
        const modelOptions = { provider: source.model_provider, model: source.model_name };
        const { results, skipped } = await processItems(items, source.source_url, supabase, steps, modelOptions);
        allResults.push(...results);
        totalSkipped += skipped;
      } catch (err) {
        steps.push({ type: 'source_error', status: 'error', label: source.label, error: err.message });
      }
    }

    const summary = {
      inserted: allResults.filter(r => r.status === 'inserted').length,
      duplicates: allResults.filter(r => r.status === 'duplicate').length,
      low_confidence: allResults.filter(r => r.status === 'low_confidence').length,
      errors: allResults.filter(r => r.status === 'error').length,
      skipped: totalSkipped,
    };
    steps.push({ type: 'summary', ...summary });

    return res.status(200).json({ ok: true, steps, summary });
  } catch (err) {
    console.error('Collect error:', err);
    return res.status(500).json({ ok: false, steps: [{ type: 'error', status: 'error', message: err.message }] });
  }
}
