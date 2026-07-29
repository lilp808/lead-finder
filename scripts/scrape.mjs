import { createClient } from '@supabase/supabase-js';
import { startAllRuns } from '../src/lib/apify.js';

async function getActiveSources() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL in env');

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('source_configs')
    .select('*')
    .eq('active', true)
    .eq('platform', 'facebook');

  if (error) throw error;
  return data || [];
}

async function main() {
  const sources = await getActiveSources();

  if (sources.length === 0) {
    console.error('No active Facebook sources configured in DB');
    process.exit(1);
  }

  const WEBHOOK_URL = process.env.VERCEL_WEBHOOK_URL;
  if (!WEBHOOK_URL) {
    console.error('No VERCEL_WEBHOOK_URL configured in env');
    process.exit(1);
  }

  const groupUrls = sources.map(s => s.source_url);
  const resultsLimits = Object.fromEntries(sources.map(s => [s.source_url, s.results_limit]));

  console.log(`Triggering Apify runs for ${sources.length} source(s)...`);
  sources.forEach(s => console.log(`  - ${s.label}: ${s.source_url} (limit: ${s.results_limit})`));

  const results = await startAllRuns(groupUrls, WEBHOOK_URL);

  for (let i = 0; i < results.length; i++) {
    const source = sources[i];
    const { data } = results[i];
    console.log(`\n  ${i + 1}. ${source.label}`);
    console.log(`     Run ID: ${data.id}`);
    console.log(`     Status: ${data.status}`);
    console.log(`     Dataset: ${data.defaultDatasetId}`);
  }

  console.log('\nDone. Apify will call the webhook when each run completes.');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
