import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  const supabase = getClient();
  const id = req.query?.id || req.body?.id;

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  if (req.method === 'PATCH') {
    const updates = {};
    if (req.body.label !== undefined) updates.label = req.body.label;
    if (req.body.source_url !== undefined) updates.source_url = req.body.source_url;
    if (req.body.results_limit !== undefined) updates.results_limit = req.body.results_limit;
    if (req.body.active !== undefined) updates.active = req.body.active;
    if (req.body.platform !== undefined) updates.platform = req.body.platform;
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length <= 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('source_configs')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Source not found' });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('source_configs')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
