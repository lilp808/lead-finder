import { getClient } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('saved_websites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { url, label } = req.body || {};

      if (!url) {
        return res.status(400).json({ error: 'url is required' });
      }

      const { data: existing } = await supabase
        .from('saved_websites')
        .select('id, url')
        .eq('url', url)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'duplicate', existing });
      }

      const { data, error } = await supabase
        .from('saved_websites')
        .insert({ url, label: label || 'none' })
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    }

    if (req.method === 'PATCH') {
      const id = req.query?.id;
      if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
      }

      const updates = {};
      if (req.body.url !== undefined) updates.url = req.body.url;
      if (req.body.label !== undefined) updates.label = req.body.label;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('saved_websites')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Website not found' });
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
      }

      const { error } = await supabase
        .from('saved_websites')
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
