import { getClient } from '../lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('search_config')
        .select('*')
        .order('config_key');

      if (error) return res.status(500).json({ error: error.message });

      const config = {};
      for (const row of data) {
        config[row.config_key] = row.config_value;
      }
      return res.status(200).json(config);
    }

    if (req.method === 'PATCH') {
      const updates = req.body || {};

      for (const [key, value] of Object.entries(updates)) {
        const { error } = await supabase
          .from('search_config')
          .upsert(
            { config_key: key, config_value: value, updated_at: new Date().toISOString() },
            { onConflict: 'config_key' }
          );

        if (error) return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
