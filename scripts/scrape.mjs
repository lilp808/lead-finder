import { startAllRuns } from '../src/lib/apify.js';

const GROUPS = JSON.parse(process.env.GROUP_URLS || '[]');
const WEBHOOK_URL = process.env.VERCEL_WEBHOOK_URL;

async function main() {
  if (GROUPS.length === 0) {
    console.error('No GROUP_URLS configured in env');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('No VERCEL_WEBHOOK_URL configured in env');
    process.exit(1);
  }

  console.log(`Triggering Apify runs for ${GROUPS.length} group(s)...`);

  const results = await startAllRuns(GROUPS, WEBHOOK_URL);

  for (let i = 0; i < results.length; i++) {
    const { data } = results[i];
    console.log(`  ${i + 1}. ${GROUPS[i]}`);
    console.log(`     Run ID: ${data.id}`);
    console.log(`     Status: ${data.status}`);
    console.log(`     Dataset: ${data.defaultDatasetId}`);
    console.log('');
  }

  console.log('Done. Apify will call the webhook when each run completes.');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
