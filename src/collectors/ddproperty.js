import { runDDSources } from '../routes/dd-collect.js';

export const platform = 'ddproperty';
export const label = 'DDProperty';

export function isAvailable() {
  return process.env.DD_ENABLED === '1';
}

export const disabledHint =
  'blocked by Cloudflare on the server — run locally: node --env-file=.env.local scripts/dd-collect.mjs';

export async function collect({ supabase, sources, steps, opts = {} }) {
  const { results } = await runDDSources(supabase, sources, steps, {
    pushSummary: false,
    sourceGapMs: 3000,
    ...opts,
  });
  return { results, skipped: 0 };
}