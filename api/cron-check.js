import { getClient } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getClient();

  const { data: schedules, error } = await supabase
    .from('cron_schedules')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error('cron-check: DB error', error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  if (!schedules || schedules.length === 0) {
    return res.status(200).json({ ok: true, message: 'no active schedules' });
  }

  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Vercel cron runs in UTC. Compare UTC hour/minute.
  const matched = schedules.find(s => s.hour === currentHour && s.minute === currentMinute);

  if (!matched) {
    return res.status(200).json({ ok: true, message: 'no schedule matched current time' });
  }

  console.log(`cron-check: schedule "${matched.label}" matched (${matched.hour}:${String(matched.minute).padStart(2, '0')} UTC), triggering ${matched.endpoint}`);

  const collectPath = matched.endpoint || '/api/collect';
  const collectUrl = `https://${req.headers.host}${collectPath}`;

  try {
    const collectRes = await fetch(collectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const collectData = await collectRes.json();
    return res.status(200).json({
      ok: true,
      triggered: true,
      schedule: matched.label,
      collect: collectData,
    });
  } catch (err) {
    console.error('cron-check: collect trigger failed', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
