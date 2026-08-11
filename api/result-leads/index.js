import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
      agent_team, province, property_type, source_platform, search,
      page = '1', limit = '20',
      sort_by = 'created_at', sort_order = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase.from('result_leads').select('*', { count: 'exact' });

    if (agent_team) {
      if (agent_team === 'none' || agent_team === 'unassigned') {
        query = query.is('agent_team', null);
      } else {
        query = query.eq('agent_team', agent_team);
      }
    }
    if (property_type) query = query.eq('property_type', property_type);
    if (province) query = query.ilike('province', `%${province}%`);
    if (source_platform) query = query.eq('source_platform', source_platform);
    if (search) {
      query = query.or(
        `address.ilike.%${search}%,post_url.ilike.%${search}%,source_name.ilike.%${search}%,ai_summary.ilike.%${search}%,province.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(from, to);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      results: data || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
