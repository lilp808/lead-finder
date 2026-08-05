import { getClient } from '../../src/lib/supabase.js';

async function handleById(supabase, id, req, res) {
  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  if (req.method === 'PATCH') {
    const updates = {};
    if (req.body.hour !== undefined) updates.hour = req.body.hour;
    if (req.body.minute !== undefined) updates.minute = req.body.minute;
    if (req.body.label !== undefined) updates.label = req.body.label;
    if (req.body.active !== undefined) updates.active = req.body.active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('cron_schedules')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Schedule not found' });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('cron_schedules')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.query?.id) {
      return handleById(supabase, req.query.id, req, res);
    }

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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
