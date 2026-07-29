import { startAllRuns } from '../src/lib/apify.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing APIFY_API_KEY in env' });
    }

    const groups = JSON.parse(process.env.GROUP_URLS || '[]');
    if (groups.length === 0) {
      return res.status(400).json({ error: 'No GROUP_URLS configured' });
    }

    const limit = parseInt(req.query?.limit) || 10;

    const host = req.headers.host || process.env.VERCEL_URL;
    const baseUrl = process.env.SITE_URL || `https://${host}`;

    const webhookUrl = `${baseUrl}/api/webhook`;

    const runs = await startAllRuns(groups, webhookUrl, limit);

    return res.status(200).json({
      ok: true,
      groupsTriggered: groups.length,
      limit,
      webhookUrl,
    });
  } catch (err) {
    console.error('Collect error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
