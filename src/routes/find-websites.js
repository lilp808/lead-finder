import { getClient } from '../lib/supabase.js';

function extractOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isExcludedDomain(origin, excludedDomains) {
  const hostname = new URL(origin).hostname;
  return excludedDomains.some(d => hostname === d || hostname.endsWith('.' + d));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'SERPER_API_KEY not configured' });
    }

    const { queries } = req.body || {};
    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'queries array is required' });
    }

    const supabase = getClient();
    const { data: configRows } = await supabase
      .from('search_config')
      .select('config_key, config_value');

    const config = {};
    for (const row of (configRows || [])) {
      config[row.config_key] = row.config_value;
    }

    const excludedDomains = config.excluded_domains || ['thaiindustrialproperty.com', 'facebook.com', 'youtube.com'];
    const searchLanguage = config.search_language || 'th';

    const searchBody = queries.map(q => ({ q, hl: searchLanguage }));

    const serperRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (!serperRes.ok) {
      const errText = await serperRes.text();
      return res.status(502).json({ error: `Serper API error (${serperRes.status}): ${errText.slice(0, 300)}` });
    }

    const serperData = await serperRes.json();

    const allResults = Array.isArray(serperData) ? serperData : [serperData];

    const origins = new Set();
    for (const result of allResults) {
      const items = result.organic || [];
      for (const item of items) {
        const link = item.link;
        if (!link) continue;

        const origin = extractOrigin(link);
        if (!origin) continue;
        if (isExcludedDomain(origin, excludedDomains)) continue;

        origins.add(origin);
      }
    }

    const websites = [...origins].sort();

    return res.status(200).json({ websites, count: websites.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
