# Property Lead Intelligence Platform

## Commands

| Command | What |
|---|---|
| `npm run scrape` | Trigger Apify facebook-groups-scraper runs for all GROUP_URLS |
| `npm run dev` | Dev server at localhost:3000 with `--watch` hot reload |
| `npm run setup:db` | Create Supabase `lead-images` storage bucket |

All scripts load env from `.env.local` via `--env-file .env.local` (not dotenv).

## Pipeline

```
npm run scrape
  └─ Apify API → start facebook-groups-scraper run per group URL
       └─ Apify scrapes → POSTs to /api/webhook (Vercel)
            ├─ Dedup by post_url (unique constraint in DB)
            ├─ Groq (llama-3.3-70b-versatile) extract Thai property data
            ├─ Download ≤10 images → Supabase Storage lead-images/{leadId}/
            └─ Insert row → leads table
```

## Key Details

- **Webhook payload**: Apify sends `webhook.data.groupUrl` in callback body. Webhook reads `req.body.webhook?.data?.groupUrl` for group_url — no extra API call.
- **Apify webhook format** (`src/lib/apify.js`): `{ requestUrl, eventTypes: ['ACTOR.RUN.SUCCEEDED'], data: { groupUrl } }`. Do NOT send plain URL strings.
- **Groq prompt** (`src/lib/groq.js`): Thai property extraction. Returns JSON. Posts with `confidence_score < 0.3` are dropped.
- **Image timeout**: 15s per image, max 10 images per post.
- **Env required**: `APIFY_API_KEY`, `APIFY_ACTOR_ID` (default `apify/facebook-groups-scraper`), `GROQ_API_KEY`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_URLS` (JSON array), `VERCEL_WEBHOOK_URL`.
- **Facebook auth**: Cookie/session must be configured inside Apify Console actor input — not in env.
- **No test/lint/typecheck framework** exists.
- **Vercel**: Function maxDuration 60s. Cron `/api/collect` daily at 6 AM (`vercel.json`).
- **ESM** throughout (`"type": "module"` in package.json).

## Constraint

Platform is property-lead-intelligence, not a Facebook scraper. Facebook is source #1; new sources must be pluggable without pipeline rewrites.
