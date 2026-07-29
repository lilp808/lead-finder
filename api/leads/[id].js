import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();
    const id = req.query?.id || req.body?.id;

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const updates = {};
      if (req.body.lead_status !== undefined) updates.lead_status = req.body.lead_status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.assigned_to !== undefined) updates.assigned_to = req.body.assigned_to;
      updates.updated_at = new Date().toISOString();

      if (Object.keys(updates).length <= 1) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
