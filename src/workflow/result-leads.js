import { normalize } from '../lib/agent-team.js';
import { comparePropertyImages } from '../lib/vision.js';

export const SQM_FIELDS = ['pricing_area_sqm', 'land_area_sqm', 'building_area_sqm'];

const SNAPSHOT_FIELDS = [
  'lead_id', 'post_url', 'source_platform', 'source_name',
  'property_type', 'listing_status',
  'rent_price', 'sale_price', 'rent_price_unit', 'sale_price_unit',
  'pricing_area_sqm', 'land_area', 'land_area_sqm', 'building_area', 'building_area_sqm',
  'province', 'district', 'sub_district', 'address', 'google_maps_url',
  'image_urls', 'ai_summary', 'ai_tags', 'confidence_score', 'agent_team',
];

export function isComplete(lead) {
  const missing = [];

  const hasSqm = SQM_FIELDS.some(f => {
    const v = lead[f];
    return v != null && v !== '' && !Number.isNaN(Number(v));
  });
  if (!hasSqm) missing.push('sqm');
  if (!lead.province) missing.push('province');
  if (!lead.district) missing.push('district');
  if (!lead.sub_district) missing.push('sub_district');
  if (!Array.isArray(lead.image_urls) || lead.image_urls.length === 0) missing.push('image');
  if (lead.rent_price == null && lead.sale_price == null) missing.push('price');
  if (!lead.agent_team) missing.push('agent_team');

  return { complete: missing.length === 0, missing };
}

export function completenessScore(lead) {
  const fields = [
    'property_type', 'listing_status', 'rent_price', 'sale_price',
    'land_area', 'building_area', 'address', 'google_maps_url',
    'contact_name', 'phone_number', 'line_id', 'ai_summary',
  ];
  let score = fields.filter(f => lead[f] != null && String(lead[f]).trim() !== '').length;
  if (Array.isArray(lead.image_urls)) score += lead.image_urls.length;
  if (lead.confidence_score != null) score += 1;
  if (lead.agent_team) score += 1;
  return score;
}

export function toSnapshot(lead) {
  const snap = {};
  for (const f of SNAPSHOT_FIELDS) snap[f] = lead[f] ?? null;
  snap.province_norm = normalize(snap.province);
  snap.district_norm = normalize(snap.district);
  snap.sub_district_norm = normalize(snap.sub_district);
  if (!Array.isArray(snap.image_urls)) snap.image_urls = [];
  return snap;
}

function sqmOverlap(a, b) {
  for (const f of SQM_FIELDS) {
    const va = a[f];
    const vb = b[f];
    if (va != null && vb != null && Number(va) === Number(vb)) return true;
  }
  return false;
}

export async function findDuplicates(supabase, lead) {
  const snap = toSnapshot(lead);
  if (!snap.province_norm || !snap.district_norm || !snap.sub_district_norm) return [];

  const { data, error } = await supabase
    .from('result_leads')
    .select('*')
    .eq('province_norm', snap.province_norm)
    .eq('district_norm', snap.district_norm)
    .eq('sub_district_norm', snap.sub_district_norm)
    .neq('lead_id', lead.id)
    .limit(50);

  if (error) throw error;

  return (data || [])
    .filter(r =>
      r.province_norm === snap.province_norm &&
      r.district_norm === snap.district_norm &&
      r.sub_district_norm === snap.sub_district_norm
    )
    .filter(r => sqmOverlap(snap, r));
}

export async function insertResultLead(supabase, lead) {
  const snap = toSnapshot(lead);
  const { data, error } = await supabase
    .from('result_leads')
    .upsert(snap, { onConflict: 'lead_id' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function markLeadMerged(supabase, leadId, mergedIntoLeadId) {
  const { error } = await supabase
    .from('leads')
    .update({
      lead_status: 'merged',
      merged_into_lead_id: mergedIntoLeadId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);
  if (error) throw error;
}

export async function compareAndMerge(supabase, newLead, candidate, opts = {}) {
  const threshold = opts.threshold ?? 0.7;
  const verify = opts.verify || comparePropertyImages;

  const vision = await verify(
    newLead.image_urls,
    candidate.image_urls,
    opts.vision || {},
  );

  if (!(vision.same_place && vision.confidence >= threshold)) {
    return { merged: false, vision };
  }

  const newScore = completenessScore(toSnapshot(newLead));
  const candScore = completenessScore(candidate);

  let winner;
  let loser;
  if (newScore > candScore) {
    winner = newLead;
    loser = candidate;
  } else if (candScore > newScore) {
    winner = candidate;
    loser = newLead;
  } else {
    winner = candidate; // tie → keep the one recorded first
    loser = newLead;
  }

  const winnerLeadId = winner === newLead ? newLead.id : candidate.lead_id;
  const loserLeadId = loser === newLead ? newLead.id : candidate.lead_id;

  let resultLeadId = null;

  if (loser === candidate) {
    const { error: delErr } = await supabase.from('result_leads').delete().eq('id', candidate.id);
    if (delErr) throw delErr;
    await markLeadMerged(supabase, candidate.lead_id, winnerLeadId);
    const inserted = await insertResultLead(supabase, newLead);
    resultLeadId = inserted.id;
  } else {
    await markLeadMerged(supabase, newLead.id, winnerLeadId);
  }

  return {
    merged: true,
    vision,
    winner: winner === newLead ? 'new' : 'existing',
    winner_lead_id: winnerLeadId,
    resultLeadId,
  };
}

export async function processLeadForResult(supabase, lead, steps = null, opts = {}) {
  const check = isComplete(lead);

  if (steps) {
    steps.push({
      type: 'workflow_check',
      status: check.complete ? 'ready' : 'incomplete',
      postUrl: lead.post_url || '',
      missing: check.missing,
      agent_team: lead.agent_team || null,
    });
  }

  if (!check.complete) {
    return { status: 'incomplete', missing: check.missing };
  }

  let candidates;
  try {
    candidates = await findDuplicates(supabase, lead);
  } catch (err) {
    if (steps) {
      steps.push({ type: 'workflow_dedup', status: 'error', error: err.message, postUrl: lead.post_url || '' });
    }
    return { status: 'error', error: err.message };
  }

  if (!candidates.length) {
    let inserted;
    try {
      inserted = await insertResultLead(supabase, lead);
    } catch (err) {
      if (steps) {
        steps.push({ type: 'workflow_ready', status: 'error', error: err.message, postUrl: lead.post_url || '' });
      }
      return { status: 'error', error: err.message };
    }
    if (steps) {
      steps.push({ type: 'workflow_ready', status: 'ok', resultLeadId: inserted.id, postUrl: lead.post_url || '' });
    }
    return { status: 'ready', resultLeadId: inserted.id };
  }

  const candidate = candidates[0];
  if (steps) {
    steps.push({
      type: 'workflow_dedup', status: 'candidate', matchedLeadId: candidate.lead_id,
      postUrl: lead.post_url || '', matchedUrl: candidate.post_url || '',
    });
  }

  let mergeResult;
  try {
    mergeResult = await compareAndMerge(supabase, lead, candidate, opts);
  } catch (err) {
    // vision failed or merge error — do not merge; still record the lead so it stays visible
    let inserted = null;
    try {
      inserted = await insertResultLead(supabase, lead);
    } catch (_) { /* keep inserted null */ }
    if (steps) {
      steps.push({
        type: 'workflow_dedup', status: 'unverified', error: err.message,
        postUrl: lead.post_url || '', matchedUrl: candidate.post_url || '',
        resultLeadId: inserted?.id || null,
      });
    }
    return { status: 'ready', resultLeadId: inserted?.id || null, unverified: true, reason: err.message };
  }

  if (steps) {
    steps.push({
      type: 'workflow_vision', status: mergeResult.vision.same_place ? 'same' : 'different',
      confidence: mergeResult.vision.confidence,
      postUrl: lead.post_url || '', matchedUrl: candidate.post_url || '',
    });
    if (mergeResult.merged) {
      steps.push({
        type: 'workflow_merged', status: 'ok', mergedInto: mergeResult.winner_lead_id,
        winner: mergeResult.winner, postUrl: lead.post_url || '', matchedUrl: candidate.post_url || '',
      });
    }
  }

  if (mergeResult.merged) {
    return {
      status: 'merged',
      winner: mergeResult.winner,
      winner_lead_id: mergeResult.winner_lead_id,
      resultLeadId: mergeResult.resultLeadId,
      vision: mergeResult.vision,
    };
  }

  let inserted;
  try {
    inserted = await insertResultLead(supabase, lead);
  } catch (err) {
    if (steps) {
      steps.push({ type: 'workflow_ready', status: 'error', error: err.message, postUrl: lead.post_url || '' });
    }
    return { status: 'error', error: err.message };
  }
  if (steps) {
    steps.push({ type: 'workflow_ready', status: 'ok', resultLeadId: inserted.id, postUrl: lead.post_url || '' });
  }
  return { status: 'ready', resultLeadId: inserted.id, vision: mergeResult.vision };
}
