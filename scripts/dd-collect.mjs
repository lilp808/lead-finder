import { getClient } from '../src/lib/supabase.js';
import { collectSources } from '../src/routes/dd-collect.js';

const SEARCH_URL =
  'https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true';

const QUOTA = Number(process.argv[2] || (process.env.DD_TEST_QUOTA ?? 10));

async function ensureSource(supabase) {
  const { data: existing } = await supabase
    .from('source_configs')
    .select('id')
    .eq('platform', 'ddproperty')
    .eq('active', true)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('source_configs')
      .update({ results_limit: QUOTA, source_url: SEARCH_URL })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('source_configs')
    .insert({
      platform: 'ddproperty',
      label: 'DDProperty Warehouse/Rent (test)',
      source_url: SEARCH_URL,
      results_limit: QUOTA,
      active: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const supabase = getClient();
  const source = await ensureSource(supabase);
  console.log(`Source ready: "${source.label}" (results_limit=${source.results_limit})`);

  console.log(`Collecting (quota=${QUOTA})...\n`);
  const { steps, summary, results } = await collectSources(supabase);

  for (const s of steps) {
    if (['fetch', 'item', 'time_limit'].includes(s.type)) {
      const line = `${s.type}[${s.status}]`;
      const extra = s.type === 'item'
        ? `${s.status}${s.images != null ? ` imgs=${s.images}` : ''}${s.price ? ` ${s.price}` : ''}${s.error ? ` ERR: ${s.error}` : ''}${s.reason ? ` reason=${s.reason}` : ''}${s.postUrl ? ` ${s.postUrl}` : ''}${s.id ? ` id=${s.id}` : ''}`
        : s.type === 'fetch'
          ? ` page ${s.page} (${s.count} listings${s.totalPages ? `/${s.totalPages}` : ''})${s.error ? ` ERR: ${s.error}` : ''}`
          : s.error ? ` ${s.error}` : ` ${s.skipped ?? 0} skipped`;
      console.log(`  ${line} ${extra}`);
    }
  }
  console.log(`\nSummary: inserted=${summary.inserted} duplicates=${summary.duplicates} errors=${summary.errors}`);
  if (results.some(r => r.status === 'inserted')) {
    console.log('Listed insert OK. First inserted post_url:');
    const { data: row } = await supabase.from('leads').select('post_url, source_platform, property_type, rent_price, image_urls').eq('source_platform', 'ddproperty').limit(3);
    (row || []).forEach(r => console.log(`  ${r.property_type} | ${r.rent_price} | imgs=${(r.image_urls || []).length} | ${r.post_url}`));
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Fatal:', err);
  process.exitCode = 1;
});