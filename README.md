# FindProperty — Lead Intelligence Platform

ระบบ **Property Lead Intelligence (FindProperty)** สำหรับเก็บประกาศอสังหาฯ จาก Facebook Groups → สกัดข้อมูลด้วย AI → จัดเก็บใน Supabase → แสดงผลใน Dashboard

เหมาะสำหรับนายหน้า / เจ้าของโครงการ ที่ต้องการติดตามประกาศแบบ real-time โดยไม่ต้องมานั่ง copy-paste เอง

---

## Tech Stack

| Component | Tech |
|---|---|
| Framework | Vanilla (ESM, `"type": "module"`) |
| Server | Node.js HTTP + Vercel Serverless Functions |
| Database | Supabase (PostgreSQL + Storage) |
| Scraping | Apify (`apify/facebook-groups-scraper`) |
| AI Extraction | Typhoon API (default) หรือ Groq API (optional) |
| UI | Vanilla HTML/CSS/JS + Lucide Icons + Poppins Font |
| CI/CD | Git push → Vercel auto-deploy |

---

## สถาปัตยกรรม Pipeline

```
[User] ──web──▶ /api/collect (sync)
                  ├─ Apify API → Scrape Facebook Group
                  ├─ Poll until done (every 3s)
                  ├─ Fetch dataset → map fields
                  ├─ Dedup by post_url
                  ├─ AI extraction (Typhoon/Groq)
                  ├─ Download & upload images to Supabase
                  └─ Insert lead to DB

[Apify] ──webhook──▶ /api/webhook (async)
                     ├─ Same pipeline as collect
                     └─ Triggered per-source when scrape finishes

[Cron] ──06:00 UTC──▶ /api/cron-check
                       ├─ Check cron_schedules table
                       └─ Match time → fetch /api/collect internally

[CLI] ──npm run scrape──▶ Read sources from DB → Start Apify + webhooks
```

---

## โครงสร้างไฟล์

```
find-property/
├── api/
│   ├── index.js              # Serve Config page (Vercel root)
│   ├── lead-page.js          # Serve Lead page (Vercel)
│   ├── collect.js            # Sync pipeline (Apify → AI → DB)
│   ├── webhook.js            # Async pipeline (Apify callback)
│   ├── cron-check.js         # Cron trigger handler
│   ├── sources/
│   │   ├── index.js          # GET/POST sources
│   │   └── [id].js           # PATCH/DELETE source
│   ├── schedules/
│   │   ├── index.js          # GET/POST schedules
│   │   └── [id].js           # PATCH/DELETE schedule
│   └── leads/
│       ├── index.js          # GET list + PATCH batch
│       ├── export.js         # GET CSV export
│       └── [id].js           # GET detail + PATCH update
├── scripts/
│   ├── test.html             # Config dashboard (Sources, Schedules, Collect)
│   ├── lead.html             # Lead cards with filters, share, export
│   └── dev.mjs               # Local dev server
├── src/
│   ├── lib/
│   │   ├── supabase.js       # DB client + image upload
│   │   └── groq.js           # AI extraction (multi-provider)
│   └── schema.sql            # Full DB schema
├── .env.example
├── vercel.json               # Cron + rewrites + timeouts
├── package.json              # Scripts: dev, scrape, setup:db
└── README.md                 # This file
```

---

## Database Schema

### `leads` — ตารางหลัก (เก็บประกาศทั้งหมด)

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `post_url` | text UNIQUE | Dedup key |
| `source_url` | text | Facebook group URL |
| `source_platform` | text | `'facebook'` (pluggable) |
| `author_name` | text | ชื่อผู้โพสต์ |
| `author_url` | text | Profile pic |
| `posted_at` | timestamptz | วันที่โพสต์ |
| `property_type` | text | บ้านเดี่ยว, คอนโด, ที่ดิน ฯลฯ |
| `listing_status` | text | rent / sale / both |
| `rent_price` | numeric | ค่าเช่า/เดือน |
| `sale_price` | numeric | ราคาขาย |
| `land_area` | text | เนื้อที่ |
| `building_area` | text | พื้นที่ใช้สอย |
| `province` / `district` / `sub_district` | text | ที่อยู่ |
| `address` | text | ที่อยู่เต็ม |
| `contact_name` / `phone_number` / `line_id` / `whatsapp` | text | ข้อมูลติดต่อ |
| `owner_or_agent` | text | owner / agent / unknown |
| `image_urls` | text[] | รูปจาก Supabase Storage |
| `raw_post_text` | text | ข้อความโพสต์ต้นฉบับ |
| `ai_summary` | text | สรุป 1-2 ประโยค |
| `ai_tags` | text[] | แท็กจาก AI |
| `confidence_score` | numeric | 0.0 - 1.0 |
| `lead_status` | text | default `'new'` |
| `notes` / `assigned_to` / `assigned_at` | | การจัดการภายใน |
| `call_history` / `appointment_history` | jsonb | ประวัติการติดต่อ |
| `roof_gps` / `roof_screenshot_url` | | (สำหรับ Roof Hunting) |

### `source_configs` — แหล่งข้อมูล

| Column | Type |
|---|---|
| `id` uuid PK | |
| `label` text | ชื่อ |
| `source_url` text | URL Facebook Group |
| `platform` text | default `'facebook'` |
| `results_limit` int | จำนวนโพสต์ต่อครั้ง |
| `active` boolean | on/off |
| `model_provider` text | `'typhoon'` / `'groq'` |
| `model_name` text | รุ่นโมเดล |

### `cron_schedules` — ตารางเวลา

| Column | Type |
|---|---|
| `id` uuid PK | |
| `hour` int | 0-23 UTC |
| `minute` int | 0-59 |
| `label` text | |
| `active` boolean | |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Config dashboard |
| GET | `/lead` | Lead page |
| GET | `/api/collect` | Run sync pipeline |
| POST | `/api/webhook` | Apify webhook callback |
| GET | `/api/cron-check` | Cron trigger |
| GET/POST | `/api/sources` | Manage sources |
| PATCH/DELETE | `/api/sources/:id` | Update/delete source |
| GET/POST | `/api/schedules` | Manage schedules |
| PATCH/DELETE | `/api/schedules/:id` | Update/delete schedule |
| GET/PATCH | `/api/leads` | List leads + batch update |
| GET | `/api/leads/export` | CSV export |
| GET/PATCH | `/api/leads/:id` | Detail + update lead |

---

## Environment Variables

| Variable | Required | Default |
|---|---|---|
| `APIFY_API_KEY` | ✅ | — |
| `APIFY_ACTOR_ID` | | `apify/facebook-groups-scraper` |
| `SUPABASE_URL` | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | |
| `TYPHOON_API_KEY` | ✅ | (provider default) |
| `GROQ_API_KEY` | | (optional alternate) |
| `VERCEL_WEBHOOK_URL` | | สำหรับ async mode |

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server `localhost:3000` |
| `npm run scrape` | CLI: read sources from DB → Apify with webhooks |
| `npm run setup:db` | Create `lead-images` storage bucket |

---

## UI Features

### Config Page (`/`)
- **Sources**: CRUD Facebook group sources, toggle on/off, set post limit & AI model
- **Schedule**: Add/remove cron schedules (Hobby plan limit: 1/day)
- **Collect**: Manual collect with real-time log + summary (Inserted/Duplicates/Skipped/Errors)

### Lead Page (`/lead`)
- **Stats bar**: Total / New / Contacted / Appointment / Closed
- **Filters**: Search text, Status, Property Type, Province — responsive collapse
- **Card Grid**: 2-col desktop / 1-col mobile
  - Image thumbnail
  - Property type + status badge
  - Price (Sale: red / Rent: blue, `฿` formatted)
  - Location
  - Contact: Phone, LINE, Name
  - Land/Building area
  - AI confidence bar
  - Date + Share/View buttons
- **Share**: Modal → formatted text → copy for LINE/WhatsApp
- **Export CSV**: Download filtered results
- **Detail Modal**: Full listing info + Contact + AI analysis + Images

---

## Constraints

- **Vercel Hobby**: Function timeout 60s (batch processing 5 items/time guard)
- **Cron**: 1 per day at 06:00 UTC (fixed time)
- **ESM only**: `"type": "module"` ใน package.json
- **env loading**: via `--env-file .env.local` (no dotenv)
- **Facebook auth**: Set cookie/session inside Apify Console, not in env
