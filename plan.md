# Property Lead Intelligence Platform

## Phase 1 — Facebook Lead Collection MVP

### Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) — Vercel Serverless + Local script |
| Scraper | Playwright Chromium (`scripts/scrape.mjs`) |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | Supabase Postgres (`leads` table) |
| Image Storage | Supabase Storage (bucket: `lead-images`, public) |

### Architecture

```
Local machine (manual / Task Scheduler)
  └─ npm run scrape
       └─ Playwright → เปิด Facebook Group → scroll → extract 10 posts
            └─ POST → Vercel /api/webhook
                 ├─ Check duplicate (post_url)
                 ├─ Groq → extract structured data
                 ├─ Download images → Supabase Storage
                 └─ Insert → Supabase `leads` table
```

---

## Status Checklist

### ✅ Done

- [x] Code structure: `api/`, `src/lib/`, `scripts/`
- [x] GitHub repo: `lilp808/lead-finder`
- [x] Deployed to Vercel: `https://lead-finder-systems.vercel.app`
- [x] Playwright installed + Chromium ready
- [x] `scripts/scrape.mjs` — Playwright scraper (headless: false)
- [x] `/api/webhook` — Groq extract + image upload + DB insert
- [x] Test Webhook → data เข้า `leads` table ได้จริง

### ⬜ Must Do

- [ ] Run `npm run scrape` ครั้งแรก → ดู data เข้า Supabase
- [ ] Verify Groq extraction quality (ปรับ prompt ถ้าข้อมูลไม่ตรง)
- [ ] Add `SITE_URL` ใน Vercel env (optional)

### 🔜 Next

- [ ] ตั้ง Windows Task Scheduler ให้รันอัตโนมัติทุกวัน
- [ ] เพิ่ม Group URL อื่นๆ ใน `GROUP_URLS`
- [ ] ถ้า scrape ได้ดี → ปิด Apify (เลิกจ่ายค่า Apify)

---

## Flow Detail

```
npm run scrape
  │
  ▼
scripts/scrape.mjs (Playwright)
  ├─ headless: false — เปิด Chromium ให้เห็น
  ├─ ไป GROUP_URLS[0]
  ├─ รอโพสต์โหลด
  ├─ scroll + extract (สูงสุด 10 โพสต์)
  └─ สร้าง JSON array → POST
       │
       ▼
Vercel /api/webhook
  ├─ เช็ค duplicate (post_url)
  ├─ Groq extract ข้อมูลทรัพย์ + contact
  ├─ Download รูป → Supabase Storage
  └─ Insert → Supabase `leads` table
```

---

## วิธีใช้

```bash
# ครั้งเดียว — ติดตั้ง Chromium
npm run scrape:install

# รัน scrape
npm run scrape

# ถ้าตั้งเวลา Windows
schtasks /create /tn "PropertyLead-Scrape" /tr "npm run scrape" /sc daily /st 13:00
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
