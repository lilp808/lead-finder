import { fetchSearchPage, DD_DEFAULT_PAGE_SIZE } from '../src/lib/ddproperty.js';
import { assignAgentTeam } from '../src/lib/agent-team.js';
import {
  getClient,
  downloadAndUploadImages,
  insertLead,
} from '../src/lib/supabase.js';

const BATCH_SIZE = 2;
const TIME_LIMIT_SEC = 55;
const IMAGES_PER_POST = 10;

function buildLead(listing, source) {
  const leadId = crypto.randomUUID();
  return {
    id: leadId,
    post_url: listing.url,
    source_url: source.source_url,
    source_platform: 'ddproperty',
    source_config_id: source.id || null,
    source_name: source.label || null,
    posted_at: listing.postedAtUnix ? new Date(listing.postedAtUnix * 1000).toISOString() : null,
    property_type: listing.propertyType,
    listing_status: listing.statusCode === 'ACT' ? 'active' : listing.statusCode || null,
    rent_price: listing.priceUnit !== 'total' ? listing.price : null,
    sale_price: listing.priceUnit === 'total' ? listing.price : null,
    rent_price_raw: listing.priceValue,
    rent_price_unit: listing.priceUnit,
    pricing_area_sqm: listing.floorAreaSqm,
    land_area: listing.landAreaText,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    province: listing.province,
    district: listing.district,
    sub_district: listing.subDistCode ? districtShort(listing) : null,
    address: listing.fullAddress,
    contact_name: listing.agentName,
    author_name: listing.agentName,
    author_url: listing.agentAvatarSrc,
    tenure: listing.tenure,
    building_area_sqm: listing.floorAreaSqm,
    image_urls: [], // filled after upload
    screenshot_urls: [],
    raw_post_text: [listing.title, listing.description, listing.listingFeatures.join(', ')].filter(Boolean).join(' | '),
    ai_summary: listing.title,
    ai_tags: listing.badges,
    confidence_score: 1,
    agent_team: assignAgentTeam({
      province: listing.province,
      district: listing.district,
      sub_district: listing.subDistCode,
    }),
  };
}

function districtShort(listing) {
  return listing.district || '';
}

function isDuplicateError(err) {
  return err?.message?.includes('duplicate key') || err?.code === '23505';
}

async function processOneListing(listing, source, supabase) {
  if (!listing.url) return { id: listing.id, status: 'no_url' };

  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('post_url', listing.url)
    .maybeSingle();

  if (existing) {
    return { id: listing.id, status: 'duplicate', reason: 'existing_url', postUrl: listing.url };
  }

  const lead = buildLead(listing, source);

  try {
    lead.image_urls = await downloadAndUploadImages(lead.id, listing.imageUrls.slice(0, IMAGES_PER_POST));
  } catch (err) {
    console.error('DD image upload failed:', err.message);
  }

  try {
    await insertLead(lead);
    return {
      id: listing.id,
      status: 'inserted',
      title: listing.title?.slice(0, 60),
      images: lead.image_urls.length,
      price: listing.pricePretty,
      property_type: listing.propertyType,
      area: listing.floorAreaSqm != null ? `${listing.floorAreaSqm} sqm` : null,
      district: listing.district || null,
      province: listing.province || null,
      postUrl: listing.url,
    };
  } catch (err) {
    if (isDuplicateError(err)) return { id: listing.id, status: 'duplicate', reason: 'existing_url', postUrl: listing.url };
    return { id: listing.id, status: 'error', error: err.message, postUrl: listing.url };
  }
}

const MAX_PAGES_PER_RUN = 5;

async function processSource(source, supabase, steps) {
  const { source_url, results_limit, label } = source;
  const quota = results_limit || DD_DEFAULT_PAGE_SIZE;

  steps.push({ type: 'source_start', status: 'ok', label, quota });

  const results = [];
  let inserted = 0;
  let duplicates = 0;
  let page = 1;
  const startTime = Date.now();

  while (inserted < quota && page <= MAX_PAGES_PER_RUN) {
    if ((Date.now() - startTime) / 1000 > TIME_LIMIT_SEC) {
      steps.push({ type: 'time_limit', status: 'warning', processed: inserted, duplicates });
      break;
    }

    let result;
    try {
      result = await fetchSearchPage(source_url, page);
    } catch (err) {
      steps.push({ type: 'fetch', status: 'error', page, error: err.message });
      break;
    }

    steps.push({ type: 'fetch', status: 'ok', page, count: result.listings.length, totalPages: result.totalPages });

    if (!result.listings.length) break;

    for (let i = 0; i < result.listings.length && inserted < quota; i += BATCH_SIZE) {
      if ((Date.now() - startTime) / 1000 > TIME_LIMIT_SEC) {
        steps.push({ type: 'time_limit', status: 'warning', processed: inserted, duplicates });
        break;
      }

      const batch = result.listings.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(listing => processOneListing(listing, source, supabase).catch(err => ({
          id: listing.id,
          status: 'error',
          error: err.message,
        })))
      );

      for (const r of batchResults) {
        if (!r) continue;
        results.push(r);
        if (r.status === 'inserted') {
          inserted += 1;
          steps.push({
            type: 'item', status: 'inserted', title: r.title, images: r.images,
            price: r.price, property_type: r.property_type, area: r.area,
            district: r.district, province: r.province, postUrl: r.postUrl || '',
          });
        } else if (r.status === 'duplicate') {
          duplicates += 1;
          steps.push({ type: 'item', status: 'duplicate', reason: r.reason || 'existing_url', postUrl: r.postUrl || '' });
        } else if (r.status === 'error') {
          steps.push({ type: 'item', status: 'error', error: r.error, postUrl: r.postUrl || '' });
        }
      }
    }

    if (result.totalPages != null && page >= result.totalPages) break;
    if (inserted < quota) page += 1;
  }

  steps.push({ type: 'fetched', status: 'ok', inserted, duplicates, pagesRead: page });
  return results;
}

export async function runDDSources(supabase, sources, steps, opts = {}) {
  const allResults = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    try {
      const sourceResults = await processSource(source, supabase, steps);
      allResults.push(...sourceResults);
    } catch (err) {
      steps.push({ type: 'source_error', status: 'error', label: source.label, error: err.message });
    }
    if (i < sources.length - 1 && (opts.sourceGapMs ?? 0) > 0) {
      await new Promise(r => setTimeout(r, opts.sourceGapMs));
    }
  }

  const summary = {
    inserted: allResults.filter(r => r.status === 'inserted').length,
    duplicates: allResults.filter(r => r.status === 'duplicate').length,
    errors: allResults.filter(r => r.status === 'error').length,
  };
  if (opts.pushSummary !== false) {
    steps.push({ type: 'summary', ...summary });
  }

  return { summary, results: allResults };
}

export async function collectSources(supabase) {
  const { data: sources, error: sourcesError } = await supabase
    .from('source_configs')
    .select('*')
    .eq('active', true)
    .eq('platform', 'ddproperty');

  if (sourcesError) {
    throw new Error(`Failed to load sources: ${sourcesError.message}`);
  }

  if (!sources || sources.length === 0) {
    throw new Error('No active DDProperty sources configured.');
  }

  const steps = [];
  const { summary, results } = runDDSources(supabase, sources, steps);
  return { steps, summary, results };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (process.env.DD_ENABLED !== '1') {
      return res.status(200).json({
        ok: false,
        steps: [{ type: 'dd_skipped', status: 'ok', count: 0, label: 'DDProperty', hint: 'DD_ENABLED is not set on this server. Run locally: node --env-file=.env.local scripts/dd-collect.mjs' }],
        summary: { inserted: 0, duplicates: 0, errors: 0 },
      });
    }

    const supabase = getClient();
    const { steps, summary } = await collectSources(supabase);

    return res.status(200).json({ ok: true, steps, summary });
  } catch (err) {
    console.error('DD collect error:', err);
    return res.status(500).json({ ok: false, steps: [{ type: 'error', status: 'error', message: err.message }] });
  }
}