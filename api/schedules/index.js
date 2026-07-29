import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  const supabase = getClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('cron_schedules')
      .select('*')
      .order('hour', { ascending: true })
      .order('minute', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { hour, minute, label } = req.body || {};

    if (hour === undefined || hour === null || hour < 0 || hour > 23) {
      return res.status(400).json({ error: 'hour is required (0-23)' });
    }
    if (minute === undefined || minute === null || minute < 0 || minute > 59) {
      return res.status(400).json({ error: 'minute is required (0-59)' });
    }

    const { data, error } = await supabase
      .from('cron_schedules')
      .insert({
        hour,
        minute: minute || 0,
        label: label || `${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`,
        active: true,
      })
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
