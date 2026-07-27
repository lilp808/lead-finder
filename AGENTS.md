# Property Lead Intelligence Platform

## Status

Phase 1 in progress. Basic file structure built — `npm install && npm run setup:db` to start.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ (ESM) on Vercel Serverless |
| Schedule | Vercel Cron (06:00 UTC daily — Hobby limit) |
| Scraper | Apify Facebook Group Scraper Actor |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | Supabase Postgres (`leads` table) |
| Image Storage | Supabase Storage (bucket: `lead-images`, public) |

## Architecture Flow

```
Vercel Cron → /api/collect
  └─ Apify Actor run per group (with webhook → /api/webhook)
       └─ Webhook receives results:
            ├─ Check duplicate (post_url unique in leads table)
            ├─ Groq → extract structured property data
            ├─ Download images → Supabase Storage (lead-images/{leadId}/)
            └─ Insert row → Supabase leads table
```

## File Structure

```
api/
  collect.js     — Cron handler: starts Apify runs
  webhook.js     — Apify callback: process results
src/
  lib/
    apify.js     — Apify API (start run, get dataset items)
    groq.js      — Groq property extraction (Thai prompts)
    supabase.js  — Supabase client, image upload, insert lead
  schema.sql     — DDL for leads table (run in Supabase SQL Editor)
scripts/
  dev.mjs        — Local dev server (Node.js http, no Vercel CLI needed)
  setup.mjs      — Create storage bucket (run once)
```

## Setup

```bash
npm install
cp .env.example .env.local   # fill in all values
# 1. Run src/schema.sql in Supabase SQL Editor
# 2. Create bucket "lead-images" (public) in Supabase Storage
npm run setup:db             # creates storage bucket (alternative to step 2)
npm run dev                  # local dev server http://localhost:3000
```

## Commands

| Command | What |
|---|---|
| `npm run dev` | Local dev server (http://localhost:3000) |
| `npm run setup:db` | Create Supabase storage bucket |

## Key Details

- **Dedup key:** `post_url` (unique constraint in DB). Skips if already exists.
- **Groq prompt** expects Thai property posts. Rejects non-property posts via `confidence_score < 0.3`.
- **Image download limit** — max 10 images per post, 15s timeout each.
- **No screenshots.** Apify provides post text + image URLs. Screenshots can be added later via Puppeteer if needed.
- **Env vars:** `APIFY_API_KEY`, `APIFY_ACTOR_ID`, `GROQ_API_KEY`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_URLS` (JSON array). Auto-loaded via `--env-file .env.local` in dev mode.
- **Webhook URL:** Auto-constructed from `VERCEL_URL` in production. For local dev, set `VERCEL_URL=http://localhost:3000` in `.env.local`.

## Future Phases

Phase 2: Multi-source → Phase 3: CRM Dashboard → Phase 4: LINE Notifications → Phase 5: AI Calling → Phase 6: Satellite/Warehouse Detection

## Constraint

This is a **Property Lead Intelligence Platform** — not a Facebook scraper. Facebook Groups is just the first source; new sources must be pluggable without rewriting the pipeline.
