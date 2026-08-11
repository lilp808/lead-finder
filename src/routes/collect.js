import { getCollector } from '../collectors/index.js';
import { getClient } from '../lib/supabase.js';
import { saveRunLog } from '../lib/log.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const supabase = getClient();

    const sourceId = req.query?.sourceId || req.body?.sourceId || null;

    let sourcesQuery = supabase
      .from('source_configs')
      .select('*')
      .eq('active', true);
    if (sourceId) {
      sourcesQuery = sourcesQuery.eq('id', sourceId);
    }

    const { data: sources, error: sourcesError } = await sourcesQuery;

    if (sourcesError) {
      throw new Error(`Failed to load sources: ${sourcesError.message}`);
    }

    const active = sources || [];
    if (active.length === 0) {
      const msg = sourceId
        ? `Source not found or inactive (${sourceId}).`
        : 'No active sources configured. Add one in Sources settings.';
      return res.status(400).json({ error: msg });
    }

    const byPlatform = active.reduce((acc, s) => {
      (acc[s.platform] = acc[s.platform] || []).push(s);
      return acc;
    }, {});

    const steps = [];
    const allResults = [];
    let totalSkipped = 0;

    for (const [platform, platformSources] of Object.entries(byPlatform)) {
      const collector = await getCollector(platform);
      if (!collector) {
        steps.push({ type: 'platform_skipped', status: 'ok', count: platformSources.length, label: platform, hint: `No collector registered for platform "${platform}".` });
        continue;
      }
      if (!collector.isAvailable()) {
        steps.push({ type: 'platform_skipped', status: 'ok', count: platformSources.length, label: collector.label, hint: collector.disabledHint || `Not enabled on this server.` });
        continue;
      }
      const { results, skipped } = await collector.collect({ supabase, sources: platformSources, steps });
      allResults.push(...results);
      totalSkipped += skipped || 0;
    }

    const summary = {
      inserted: allResults.filter(r => r.status === 'inserted').length,
      duplicates: allResults.filter(r => r.status === 'duplicate').length,
      low_confidence: allResults.filter(r => r.status === 'low_confidence').length,
      errors: allResults.filter(r => r.status === 'error').length,
      skipped: totalSkipped,
      total: allResults.length,
    };
    steps.push({ type: 'summary', ...summary });

    await saveRunLog(steps, summary).catch(err => {
      console.error('Failed to save lead_logs:', err.message);
    });

    return res.status(200).json({ ok: true, steps, summary });
  } catch (err) {
    console.error('Collect error:', err);
    return res.status(500).json({ ok: false, steps: [{ type: 'error', status: 'error', message: err.message }] });
  }
}