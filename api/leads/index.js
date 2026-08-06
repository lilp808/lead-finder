import { getClient } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method === 'GET') {
      const {
        status, property_type, province, search, source_platform, source_name,
        page = '1', limit = '20',
        sort_by = 'collected_at', sort_order = 'desc',
      } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const from = (pageNum - 1) * limitNum;
      const to = from + limitNum - 1;

      let query = supabase.from('leads').select('*', { count: 'exact' });

      if (status) {
        const statuses = status.split(',');
        if (statuses.length === 1) {
          query = query.eq('lead_status', status);
        } else {
          query = query.in('lead_status', statuses);
        }
      }
      if (property_type) query = query.eq('property_type', property_type);
      if (province) query = query.ilike('province', `%${province}%`);
      if (source_platform) query = query.eq('source_platform', source_platform);
      if (source_name) query = query.eq('source_name', source_name);
      if (search) {
        query = query.or(
          `raw_post_text.ilike.%${search}%,author_name.ilike.%${search}%,contact_name.ilike.%${search}%,address.ilike.%${search}%,phone_number.ilike.%${search}%,line_id.ilike.%${search}%`
        );
      }

      const { data, count, error } = await query
        .order(sort_by, { ascending: sort_order === 'asc' })
        .range(from, to);

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        leads: data || [],
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      });
    }

    if (req.method === 'PATCH') {
      const { ids, updates } = req.body || {};
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'updates object is required' });
      }
      const allowed = ['lead_status', 'notes', 'assigned_to'];
      const clean = {};
      for (const key of allowed) {
        if (updates[key] !== undefined) clean[key] = updates[key];
      }
      clean.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('leads')
        .update(clean)
        .in('id', ids)
        .select('*');

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ updated: data.length });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
