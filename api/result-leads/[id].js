import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();
    const id = req.query?.id || req.body?.id;

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data, error } = await supabase
      .from('result_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Result lead not found' });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
