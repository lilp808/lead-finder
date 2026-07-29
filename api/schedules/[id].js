import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();
    const id = req.query?.id;

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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
