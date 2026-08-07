import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method === 'GET') {
      const { search, page = '1', limit = '20' } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      let query = supabase.from('lead_logs').select('*', { count: 'exact' });

      if (search) {
        query = query.or(`label.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .order('ran_at', { ascending: false })
        .range(from, to);

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        logs: data || [],
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}