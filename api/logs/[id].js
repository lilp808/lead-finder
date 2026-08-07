import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();
    const { id } = req.query;

    if (!id) return res.status(400).json({ error: 'id is required' });

    const { data, error } = await supabase
      .from('lead_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Log not found' });

    let steps = [];
    try {
      steps = typeof data.steps === 'string' ? JSON.parse(data.steps) : (data.steps || []);
    } catch {
      steps = [];
    }

    return res.status(200).json({ log: { ...data, steps } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}