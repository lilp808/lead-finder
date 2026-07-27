import { startAllRuns } from '../src/lib/apify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const groups = JSON.parse(process.env.GROUP_URLS || '[]');
  if (groups.length === 0) {
    return res.status(400).json({ error: 'No GROUP_URLS configured' });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `https://${req.headers.host}`;

  const webhookUrl = `${baseUrl}/api/webhook`;

  const runs = await startAllRuns(groups, webhookUrl);

  return res.status(200).json({
    ok: true,
    groupsTriggered: groups.length,
    webhookUrl,
  });
}
