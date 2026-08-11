import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) {
  console.error('Missing SUPABASE_URL in env');
  process.exit(1);
}

const supabase = createClient(url, key);

const BATCH = 200;

async function main() {
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const { data: resultLeads, error } = await supabase
      .from('result_leads')
      .select('id, lead_id, google_maps_url')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) throw error;
    if (!resultLeads || resultLeads.length === 0) break;

    const leadIds = resultLeads.map(r => r.lead_id).filter(Boolean);
    const leadMap = new Map();

    if (leadIds.length > 0) {
      const { data: leads, error: leadErr } = await supabase
        .from('leads')
        .select('id, google_maps_url')
        .in('id', leadIds);

      if (leadErr) throw leadErr;
      for (const l of leads || []) leadMap.set(l.id, l.google_maps_url);
    }

    const updates = [];
    for (const r of resultLeads) {
      scanned += 1;
      const leadUrl = leadMap.get(r.lead_id);
      if (!leadUrl) {
        skipped += 1;
        continue;
      }
      if (r.google_maps_url !== leadUrl) {
        updates.push({ id: r.id, google_maps_url: leadUrl, updated_at: new Date().toISOString() });
      }
    }

    if (updates.length > 0) {
      const { error: updErr } = await supabase
        .from('result_leads')
        .upsert(updates);
      if (updErr) throw updErr;
      updated += updates.length;
    }

    console.log(`batch ${offset / BATCH + 1}: scanned ${resultLeads.length}, updated ${updates.length}`);
    if (resultLeads.length < BATCH) break;
    offset += BATCH;
  }

  console.log(`\nDone. Scanned ${scanned}, updated ${updated}, skipped (lead has no map url / not found) ${skipped}.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
