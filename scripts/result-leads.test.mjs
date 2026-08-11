import { isComplete, toSnapshot, findDuplicates, compareAndMerge } from '../src/workflow/result-leads.js';

let failures = 0;
function assert(name, cond) {
  if (!cond) { failures += 1; console.log('FAIL:', name); }
  else console.log('ok:', name);
}

const completeLead = {
  id: 'lead-new',
  post_url: 'http://fb/1',
  source_platform: 'facebook',
  property_type: 'Warehouse',
  pricing_area_sqm: 500,
  land_area_sqm: 1000,
  province: 'Samut Prakan',
  district: 'Bang Phli',
  sub_district: 'Bang Kaew',
  image_urls: ['http://img/a'],
  rent_price: 50000,
  agent_team: 'A',
  ai_summary: 'ok',
};

assert('complete lead passes', isComplete(completeLead).complete === true);

const incomplete = { ...completeLead, rent_price: null, agent_team: null };
const chk = isComplete(incomplete);
assert('incomplete flags price+agent', !chk.complete && chk.missing.includes('price') && chk.missing.includes('agent_team'));

const snap = toSnapshot(completeLead);
assert('snapshot normalizes location', snap.province_norm === 'samut prakan' && snap.sub_district_norm === 'bang kaew');

function mockSupabase() {
  const rows = [];
  return {
    rows,
    from() {
      const q = {
        _query: null,
        select() { this._rows = rows; return this; },
        eq(k, v) { this._eq = { k, v }; return this; },
        neq() { return this; },
        limit() { return this; },
        async then(resolve, reject) { resolve({ data: [...this._rows], error: null }); },
        async delete() {
          const k = this._eq?.k;
          const v = this._eq?.v;
          const idx = rows.findIndex(r => r[k] === v);
          if (idx >= 0) rows.splice(idx, 1);
          return { error: null };
        },
        update() { return this; },
      };
      return q;
    },
  };
}

async function testFindDuplicates() {
  const sb = mockSupabase();
  const existing = toSnapshot({ ...completeLead, id: 'lead-old', image_urls: ['http://img/old'], rent_price: 45000 });
  existing.id = 'res-old';
  existing.lead_id = 'lead-old';
  sb.rows.push(existing);

  const cands = await findDuplicates(sb, completeLead);
  assert('finds same location+sqm candidate', cands.length === 1 && cands[0].lead_id === 'lead-old');

  const differentSqm = toSnapshot({ ...completeLead, id: 'lead-old2', pricing_area_sqm: 900, land_area_sqm: 900, image_urls: ['http://img/old2'] });
  differentSqm.id = 'res-old2';
  differentSqm.lead_id = 'lead-old2';
  sb.rows.push(differentSqm);

  const cands2 = await findDuplicates(sb, completeLead);
  assert('excludes different sqm', cands2.length === 1);
}

async function testMergeNewWins() {
  const sb = mockSupabase();
  const existing = toSnapshot({ ...completeLead, id: 'lead-old', image_urls: ['http://img/old'], rent_price: 45000, agent_team: 'A' });
  existing.id = 'res-old';
  existing.lead_id = 'lead-old';
  sb.rows.push(existing);
  const newLead = { ...completeLead, image_urls: ['http://img/a', 'http://img/a2', 'http://img/a3'] };
  let mergedUpdates = [];

  const updates = [];
  const supabase = {
    from(t) {
      if (t === 'result_leads') {
        const q = {
          delete() {
            return { eq(k, v) { return { then: async (res) => res({ error: null }) }; } };
          },
          upsert() { return { select() { return { single() { return { then: async res => res({ data: { id: 'res-new' } }) }; } }; } }; },
        };
        return q;
      }
      if (t === 'leads') {
        return {
          update(u) { updates.push(u); return { eq() { return { then: async res => res({ error: null }) }; } }; },
        };
      }
      return {};
    },
  };

  const res = await compareAndMerge(supabase, newLead, existing, {
    verify: async () => ({ same_place: true, confidence: 0.95, reason: 'same' }),
  });
  assert('merge happened, new lead wins (more images)', res.merged === true && res.winner === 'new');
  assert('loser lead marked merged', updates.some(u => u.lead_status === 'merged' && u.merged_into_lead_id === 'lead-new'));
}

async function testMergeExistingWins() {
  const existing = { ...completeLead, id: 'res-old', lead_id: 'lead-old', image_urls: ['http://img/old', 'http://img/old2'] };
  const updates = [];
  const supabase = {
    from(t) {
      if (t === 'leads') {
        return {
          update(u) { updates.push(u); return { eq() { return { then: async res => res({ error: null }) }; } }; },
        };
      }
      return {};
    },
  };
  const res = await compareAndMerge(supabase, completeLead, existing, {
    verify: async () => ({ same_place: true, confidence: 0.95, reason: 'same' }),
  });
  assert('merge keeps more complete existing (more images)', res.merged === true && res.winner === 'existing');
  assert('new lead marked merged into existing', updates.some(u => u.merged_into_lead_id === 'lead-old'));
}

async function testVisionDifferentNoMerge() {
  const existing = { ...completeLead, id: 'res-old', lead_id: 'lead-old', image_urls: ['http://img/old'] };
  const sb = {
    from() {
      return {
        upsert() { return { select() { return { single() { return { then: async res => res({ data: { id: 'res-new' } }) }; } }; } }; },
        delete() { return { eq() { return { then: async res => res({ error: null }) }; } }; },
      };
    },
  };
  const res = await compareAndMerge(sb, completeLead, existing, {
    verify: async () => ({ same_place: false, confidence: 0.1, reason: 'different' }),
  });
  assert('different place → no merge', res.merged === false);
}

await testFindDuplicates();
await testMergeNewWins();
await testMergeExistingWins();
await testVisionDifferentNoMerge();

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll tests passed.');
process.exit(failures ? 1 : 0);
