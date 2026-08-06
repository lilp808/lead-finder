import { createClient } from '@supabase/supabase-js';
import { assignAgentTeam } from '../src/lib/agent-team.js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) {
  console.error('Missing SUPABASE_URL in env');
  process.exit(1);
}

const supabase = createClient(url, key);

const BATCH = 500;

async function fetchUntagged(offset) {
  const { data, error } = await supabase
    .from('leads')
    .select('id, province, district, sub_district, agent_team')
    .is('agent_team', null)
    .range(offset, offset + BATCH - 1);

  if (error) throw error;
  return data || [];
}

async function main() {
  let offset = 0;
  let updated = 0;
  let alreadyNull = 0;
  let total = 0;

  while (true) {
    const leads = await fetchUntagged(offset);
    if (leads.length === 0) break;
    total += leads.length;

    const updates = [];
    for (const lead of leads) {
      const team = assignAgentTeam(lead);
      if (team) {
        updates.push({ id: lead.id, agent_team: team });
      } else {
        alreadyNull += 1;
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase
        .from('leads')
        .upsert(updates);
      if (error) throw error;
      updated += updates.length;
      console.log(`batch ${offset / BATCH + 1}: scanned ${leads.length}, updated ${updates.length}, needs-review ${leads.length - updates.length}`);
    }

    if (leads.length < BATCH) break;
    offset += BATCH;
  }

  console.log(`\nDone. Scanned ${total}, assigned ${updated}, left unassigned (needs review) ${alreadyNull}.`);
  console.log('Note: run again later after location data improves, or assign manually.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
