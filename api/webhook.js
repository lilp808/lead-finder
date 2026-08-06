import { getDatasetItems } from '../src/lib/apify.js';
import { processItems } from '../src/collectors/facebook.js';
import { getClient } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      const raw = await new Promise(resolve => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => resolve(data));
      });
      req.body = raw ? JSON.parse(raw) : {};
    }

    const { eventType, resource } = req.body;

    if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
      return res.status(200).json({ ok: true, message: 'ignored' });
    }

    const mockItems = req.body?._mockItems;

    if (!mockItems && !resource?.defaultDatasetId) {
      return res.status(200).json({ ok: true, message: 'no dataset' });
    }

    const items = mockItems || await getDatasetItems(resource.defaultDatasetId);
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(200).json({ ok: true, message: 'no items' });
    }

    const sourceUrl = req.body?.webhook?.data?.groupUrl || '';

    const supabase = getClient();
    const { results, skipped } = await processItems(items, sourceUrl, supabase);

    return res.status(200).json({
      ok: true,
      processed: results.length,
      skipped,
      results,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}