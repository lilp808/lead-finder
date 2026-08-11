import { createClient } from '@supabase/supabase-js';
import { processLeadForResult } from '../src/workflow/result-leads.js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) {
  console.error('Missing SUPABASE_URL in env');
  process.exit(1);
}

const supabase = createClient(url, key);

const BATCH = 200;

async function fetchProcessedLeadIds() {
  const ids = new Set();

  const { data: resultLeads } = await supabase
    .from('result_leads')
    .select('lead_id');
  for (const r of resultLeads || []) ids.add(r.lead_id);

  const { data: merged } = await supabase
    .from('leads')
    .select('id')
    .eq('lead_status', 'merged');
  for (const m of merged || []) ids.add(m.id);

  return ids;
}

async function main() {
  const processedIds = await fetchProcessedLeadIds();
  console.log(`Already processed: ${processedIds.size} leads (in result_leads or merged).`);

  const stats = { scanned: 0, ready: 0, incomplete: 0, merged: 0, error: 0, unverified: 0 };
  let offset = 0;

  while (true) {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .order('collected_at', { ascending: true })
      .range(offset, offset + BATCH - 1);

    if (error) throw error;
    if (!leads || leads.length === 0) break;

    for (const lead of leads) {
      if (processedIds.has(lead.id)) {
        continue;
      }

      stats.scanned += 1;

      const steps = [];
      try {
        const wf = await processLeadForResult(supabase, lead, steps);
        if (wf.status === 'ready' && wf.unverified) {
          stats.unverified += 1;
        } else {
          stats[wf.status] = (stats[wf.status] || 0) + 1;
        }
      } catch (err) {
        stats.error += 1;
        console.error(`[${lead.id}] ${lead.post_url || ''} — ${err.message}`);
      }
    }

    console.log(`batch ${offset / BATCH + 1}: ${leads.length} scanned`);

    if (leads.length < BATCH) break;
    offset += BATCH;
  }

  console.log('\nDone.');
  console.log('Processed (non-empty checks):', stats);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
