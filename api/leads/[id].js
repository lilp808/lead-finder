import { getClient } from '../../src/lib/supabase.js';
import { assignAgentTeam } from '../../src/lib/agent-team.js';

export default async function handler(req, res) {
  try {
    const supabase = getClient();
    const id = req.query?.id || req.body?.id;

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json(data);
    }

    if (req.method === 'PATCH') {
      const updates = {};
      let locationEdited = false;
      if (req.body.lead_status !== undefined) updates.lead_status = req.body.lead_status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.assigned_to !== undefined) updates.assigned_to = req.body.assigned_to;
      if (req.body.agent_team !== undefined) updates.agent_team = req.body.agent_team || null;
      if (req.body.province !== undefined) { updates.province = req.body.province; locationEdited = true; }
      if (req.body.district !== undefined) { updates.district = req.body.district; locationEdited = true; }
      if (req.body.sub_district !== undefined) { updates.sub_district = req.body.sub_district; locationEdited = true; }
      updates.updated_at = new Date().toISOString();

      // Recompute agent_team from the latest location unless overridden manually.
      if (locationEdited && req.body.agent_team === undefined) {
        const { data: current } = await supabase
          .from('leads')
          .select('province, district, sub_district, agent_team')
          .eq('id', id)
          .single();

        const merged = {
          province: updates.province ?? current?.province,
          district: updates.district ?? current?.district,
          sub_district: updates.sub_district ?? current?.sub_district,
        };
        updates.agent_team = assignAgentTeam(merged);
      }

      if (Object.keys(updates).length <= 1) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
