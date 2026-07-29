# Property Lead Intelligence Platform

## Commands

| Command | What |
|---|---|
| `npm run scrape` | Trigger Apify facebook-groups-scraper runs for all active sources in DB |
| `npm run dev` | Dev server at localhost:3000 with `--watch` hot reload |
| `npm run setup:db` | Create Supabase `lead-images` storage bucket |

All scripts load env from `.env.local` via `--env-file .env.local` (not dotenv).

## Pipeline

### Synchronous (via web UI)
```
/api/collect
  └─ Read active sources from source_configs DB table
       └─ For each source: Apify API → start actor run → poll every 3s until done
            └─ Fetch dataset → map Apify fields (user.name→authorName etc.)
                 └─ For each item: dedup → Groq extract → images → Supabase insert
```

### Async (via cron `vercel.json` 6 AM)
```
/api/collect (cron) → same as sync, reads all active sources from DB
```

### Alternative async (via CLI `npm run scrape`)
```
Read active sources from DB → start Apify runs with webhook URLs per source
  └─ Apify scrapes → POSTs to /api/webhook
       └─ Dedup → Groq → images → Supabase insert
```

## Key Details

- **Webhook payload**: Apify sends `webhook.data.groupUrl` in callback body. Webhook reads `req.body.webhook?.data?.groupUrl` for group_url — no extra API call.
- **Apify webhook format** (`src/lib/apify.js`): `{ requestUrl, eventTypes: ['ACTOR.RUN.SUCCEEDED'], data: { groupUrl } }`. Do NOT send plain URL strings.
- **Apify output mapping** (`api/collect.js`): `user.name→authorName`, `user.profilePic→authorUrl`, `attachments[].image.uri→imageUrls`, `time→createdAt`, `inputUrl→groupUrl`.
- **Groq prompt** (`src/lib/groq.js`): Thai property extraction. Returns JSON. Posts with `confidence_score < 0.3` are dropped.
- **Image timeout**: 15s per image, max 10 images per post.
- **Env required**: `APIFY_API_KEY`, `APIFY_ACTOR_ID` (default `apify/facebook-groups-scraper`), `GROQ_API_KEY`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_WEBHOOK_URL`.
- **Facebook auth**: Cookie/session must be configured inside Apify Console actor input — not in env.
- **No test/lint/typecheck framework** exists.
- **Vercel**: Function maxDuration 60s. Cron `/api/collect` daily at 6 AM (`vercel.json`).
- **ESM** throughout (`"type": "module"` in package.json).

## Constraint

Platform is property-lead-intelligence, not a Facebook scraper. Facebook is source #1; new sources must be pluggable without pipeline rewrites.
