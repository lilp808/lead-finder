import { getClient } from '../lib/supabase.js';

async function handleById(supabase, id, req, res) {
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
    if (req.body.model_provider !== undefined) updates.model_provider = req.body.model_provider;
    if (req.body.model_name !== undefined) updates.model_name = req.body.model_name;
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

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.query?.id) {
      return handleById(supabase, req.query.id, req, res);
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('source_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { platform, label, source_url, results_limit, model_provider, model_name } = req.body || {};

      if (!label || !source_url) {
        return res.status(400).json({ error: 'label and source_url are required' });
      }

      const { data, error } = await supabase
        .from('source_configs')
        .insert({
          platform: platform || 'facebook',
          label,
          source_url,
          results_limit: results_limit ?? 5,
          active: true,
          model_provider: model_provider || 'typhoon',
          model_name: model_name || 'typhoon-v2.5-30b-a3b-instruct',
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
