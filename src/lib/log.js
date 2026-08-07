import { getClient } from './supabase.js';

export function formatRunLabel(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function saveRunLog(steps = [], summary = {}) {
  let client;
  try {
    client = getClient();
  } catch {
    return null;
  }

  const safeSteps = (Array.isArray(steps) ? steps : []).map(s => {
    const copy = { ...s };
    for (const key of Object.keys(copy)) {
      if (typeof copy[key] === 'string' && copy[key].length > 2000) {
        copy[key] = copy[key].slice(0, 2000);
      }
    }
    return copy;
  });

  const row = {
    label: formatRunLabel(),
    trigger: 'manual',
    platform: 'all',
    summary: summary,
    steps: safeSteps,
    total: summary.total ?? 0,
    inserted: summary.inserted ?? 0,
    duplicates: summary.duplicates ?? 0,
    low_confidence: summary.low_confidence ?? 0,
    errors: summary.errors ?? 0,
    skipped: summary.skipped ?? 0,
  };

  const { error } = await client.from('lead_logs').insert(row);
  if (error) {
    console.error('Failed to save collect run log:', error.message);
    return null;
  }
  return row;
}