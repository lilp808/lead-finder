import { getClient } from '../../src/lib/supabase.js';

const CSV_COLS = [
  'id', 'post_url', 'source_url', 'source_platform', 'author_name', 'posted_at', 'collected_at',
  'property_type', 'listing_status', 'rent_price', 'sale_price', 'land_area', 'building_area',
  'province', 'district', 'sub_district', 'address',
  'contact_name', 'phone_number', 'line_id', 'whatsapp', 'owner_or_agent',
  'lead_status', 'confidence_score', 'lead_score', 'ai_summary',
  'assigned_to',
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(rows) {
  const header = CSV_COLS.join(',');
  const lines = rows.map(row =>
    CSV_COLS.map(col => {
      if (col === 'ai_summary') return escapeCsv(row[col] || '');
      if (['rent_price', 'sale_price'].includes(col)) return row[col] ?? '';
      if (['confidence_score', 'lead_score'].includes(col)) return row[col] ?? '';
      return escapeCsv(row[col]);
    }).join(',')
  );
  return '\uFEFF' + header + '\n' + lines.join('\n');
}

export default async function handler(req, res) {
  try {
    const supabase = getClient();

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { status, property_type, province, search, source_platform, sort_by = 'collected_at', sort_order = 'desc' } = req.query;

    let query = supabase.from('leads').select('*');

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
    if (search) {
      query = query.or(
        `raw_post_text.ilike.%${search}%,author_name.ilike.%${search}%,contact_name.ilike.%${search}%,address.ilike.%${search}%,phone_number.ilike.%${search}%,line_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query
      .order(sort_by, { ascending: sort_order === 'asc' });

    if (error) {
      res.status(500);
      return res.json({ error: error.message });
    }

    const csv = toCSV(data || []);
    const filename = `findproperty-leads-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200);
    return res.end(csv);
  } catch (err) {
    res.status(500);
    return res.json({ error: err.message });
  }
}
