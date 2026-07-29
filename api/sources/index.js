import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

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
