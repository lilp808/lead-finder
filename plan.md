# Property Lead Intelligence Platform

## Phase 1 — Facebook Lead Collection MVP

### Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) on Vercel Serverless |
| Schedule | Vercel Cron (06:00 UTC daily — Hobby limit) |
| Scraper | Apify Facebook Groups Scraper Actor |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | Supabase Postgres (`leads` table) |
| Image Storage | Supabase Storage (bucket: `lead-images`, public) |

### Architecture

```
Vercel Cron → /api/collect
  └─ Apify Actor run per group (webhook → /api/webhook)
       └─ Webhook:
            ├─ Check duplicate (post_url)
            ├─ Groq → extract structured data
            ├─ Download images → Supabase Storage
            └─ Insert → Supabase `leads` table
```

---

## Status Checklist

### ✅ Done

- [x] Code structure: `api/`, `src/lib/`, `scripts/`, `vercel.json`
- [x] GitHub repo pushed: `lilp808/lead-finder`
- [x] Deployed to Vercel: `https://lead-finder-systems.vercel.app`
- [x] Test dashboard at `/`
- [x] `/api/collect` triggers Apify successfully
- [x] Webhook URL auto-constructed (supports `SITE_URL` env)

### ⬜ Must Do (before data flows)

- [ ] **Run `src/schema.sql` in Supabase SQL Editor** — creates `leads` table
- [ ] **Create bucket `lead-images`** (public) in Supabase Storage
- [ ] **Set env vars in Vercel dashboard**: `APIFY_API_KEY`, `APIFY_ACTOR_ID`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_URLS`
- [ ] **Test pipeline** — use dashboard Test Webhook with sample data, or wait for next cron run

### 🔜 Next

- [ ] Verify Groq extraction quality (adjust prompt if needed)
- [ ] Add `SITE_URL=https://lead-finder-systems.vercel.app` in Vercel env for clean webhook URLs
- [ ] Add more Facebook Group URLs to `GROUP_URLS`
- [ ] Monitor first cron run at 06:00 UTC

---

## Flow Detail

```
Vercel Cron (06:00 UTC)
  │
  ▼
/api/collect
  ├─ อ่าน GROUP_URLS
  ├─ สร้าง webhook URL
  └─ Apify API → startActorRun(groupUrl, webhookUrl)
       │
       ▼ (async — Apify ส่ง callback)
/api/webhook
  ├─ eventType == ACTOR.RUN.SUCCEEDED?
  ├─ อ่าน datasetItems จาก Apify
  └─ แต่ละ post:
       ├─ post_url ซ้ำ? → ข้าม
       ├─ Groq extract
       │    └─ confidence < 0.3 → ข้าม
       ├─ Download รูป (สูงสุด 10, timeout 15s)
       │    └─ Upload → Supabase Storage /lead-images/{leadId}/
       └─ Insert → Supabase `leads` table
```

---

## Future Phases

| Phase | What |
|---|---|
| 2 | Multi-source (DDProperty, LivingInsider, agent/dev sites) |
| 3 | CRM Dashboard (search, filters, assignment, follow-up) |
| 4 | LINE Notifications + reminders |
| 5 | AI Calling Assistant |
| 6 | Satellite/Warehouse Detection |

---

## Constraint

Property Lead Intelligence Platform — not a Facebook scraper. Facebook Groups is source #1; new sources must be pluggable without rewriting the pipeline.
