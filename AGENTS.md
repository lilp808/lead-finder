# Property Lead Intelligence Platform

## Status

Phase 1 in progress. Scraper ใช้ Playwright (local), API + AI pipeline อยู่บน Vercel.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) — Vercel Serverless + Local script |
| Scraper | Playwright Chromium (`scripts/scrape.mjs`) |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | Supabase Postgres (`leads` table) |
| Image Storage | Supabase Storage (bucket: `lead-images`, public) |

## Architecture Flow

```
Local machine → npm run scrape
  └─ Playwright → Facebook Group → scroll + extract 10 posts
       └─ POST → Vercel /api/webhook
            ├─ Check duplicate (post_url unique in leads table)
            ├─ Groq → extract structured property data
            ├─ Download images → Supabase Storage (lead-images/{leadId}/)
            └─ Insert row → Supabase leads table
```

## File Structure

```
api/
  index.js       — Root test dashboard
  collect.js     — (legacy) Apify cron trigger
  webhook.js     — Callback: Groq extract + image upload + DB insert
src/
  lib/
    apify.js     — (legacy) Apify API
    groq.js      — Groq property extraction (Thai prompts)
    supabase.js  — Supabase client, image upload, insert lead
  schema.sql     — DDL for leads table
scripts/
  scrape.mjs     — Playwright scraper (main entry)
  dev.mjs        — Local dev server
  setup.mjs      — Create storage bucket
  test.html      — Test dashboard HTML
```

## Setup

```bash
npm install
cp .env.example .env.local   # fill in all values
npm run scrape:install        # install Chromium (first time only)
npm run setup:db              # create Supabase storage bucket
# 1. Run src/schema.sql in Supabase SQL Editor
# 2. Set env vars in Vercel dashboard
```

## Commands

| Command | What |
|---|---|
| `npm run scrape` | Run Playwright scraper (opens browser) |
| `npm run scrape:install` | Install Chromium (first time) |
| `npm run dev` | Local dev server (http://localhost:3000) |
| `npm run setup:db` | Create Supabase storage bucket |

## Key Details

- **Dedup key:** `post_url` (unique constraint in DB). Skips if already exists.
- **Groq prompt** expects Thai property posts. Rejects non-property posts via `confidence_score < 0.3`.
- **Image download limit** — max 10 images per post, 15s timeout each.
- **Scraper:** `headless: false` (visible browser), scrolls up to 10 posts per group.
- **Env vars:** `GROQ_API_KEY`, `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_URLS` (JSON array), `VERCEL_WEBHOOK_URL`. Auto-loaded via `--env-file .env.local`.
- **Webhook URL:** Set `VERCEL_WEBHOOK_URL` in `.env.local` ถึง `https://lead-finder-systems.vercel.app/api/webhook`.

## Future Phases

Phase 2: Multi-source → Phase 3: CRM Dashboard → Phase 4: LINE Notifications → Phase 5: AI Calling → Phase 6: Satellite/Warehouse Detection

## Constraint

Property Lead Intelligence Platform — not a Facebook scraper. Facebook Groups is source #1; new sources must be pluggable without rewriting the pipeline.
