# Property Lead Intelligence Platform
## Phase 1 - Facebook Lead Collection MVP

## Objective

Build an automated system that collects new property listings from Facebook Groups and converts them into structured property leads for the sales team.

The goal is **not** to build a Facebook Scraper, but to build a **Property Lead Intelligence Platform** that can support multiple lead sources in the future.

---

# Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM) on Vercel Serverless |
| Schedule | Vercel Cron (06:00 UTC วันละครั้ง — Hobby limit) |
| Scraper | Apify Facebook Group Scraper Actor |
| LLM | Groq (llama-3.3-70b-versatile) |
| Database | Supabase Postgres |
| Image Storage | Supabase Storage (bucket: lead-images) |

---

# Architecture Flow

```
Vercel Cron → /api/collect
  └─ Loop GROUP_URLS[]
       └─ Apify Actor run (with webhook → /api/webhook)
            └─ Apify ส่ง callback กลับมา
                 ├─ 1. Check duplicate (post_url)
                 ├─ 2. Groq → extract structured data
                 ├─ 3. Download images → Supabase Storage
                 └─ 4. Insert → Supabase `leads` table
```

---

# Phase 1 Scope

Source

- Facebook Groups (กำหนดหลายกลุ่มได้ผ่าน env `GROUP_URLS`)

Output

- Structured Property Lead (ใน Supabase `leads` table)
- Property Images (ใน Supabase Storage)
- Post URL (สามารถกลับไปดูโพสต์ต้นทางได้)

ตัดออกจากแผนเดิม

- ~~Google Sheet~~ → ใช้ Supabase เก็บโดยตรง
- ~~Screenshot Capture~~ → Apify ให้ text + image URLs มาแล้ว, ไม่ต้องแคปเพิ่ม
- ~~Master Database Layer~~ → Supabase เป็นทั้ง DB + Storage

---

# Property Lead Schema

## Basic Information

- Lead ID (uuid)
- Source Platform
- Group URL
- Original Post URL
- Posted Date
- Collected Date

## Property Information

- Property Type
- Listing Status (rent/sale/both)
- Rent Price
- Sale Price
- Land Area
- Building Area
- Province
- District
- Sub District
- Address
- AI Estimated Location (future)

## Contact Information

- Contact Name
- Phone Number
- LINE ID
- WhatsApp
- WeChat
- Owner / Agent Classification

## Media

- Image URLs (array, stored in Supabase Storage path: `{lead_id}/{filename}`)

## AI Information

- AI Summary
- AI Tags
- Lead Score
- Duplicate Score (built-in via post_url unique)
- Confidence Score

## Internal Tracking

- Lead Status (new / contacted / closed)
- Notes

---

# Pipeline Detail

```
Vercel Cron (06:00 UTC — วันละครั้ง)
  │
  ▼
/api/collect
  │
  ├─ อ่าน GROUP_URLS จาก env
  ├─ สร้าง webhook URL (VERCEL_URL + /api/webhook)
  └─ เรียก Apify API → startActorRun(กลุ่ม, webhook)
       │
       ▼ (async — Apify ส่ง callback)
/api/webhook
  │
  ├─ เช็ค eventType == ACTOR.RUN.SUCCEEDED
  ├─ อ่าน datasetItems จาก Apify
  │
  └─ สำหรับแต่ละ post ในผลลัพธ์:
       │
       ├─ เช็ค duplicate: post_url มีใน DB แล้ว? → ข้าม
       │
       ├─ ส่ง post.text → Groq API
       │     └─ prompt: extract ข้อมูลทรัพย์ฯ + contact + AI summary
       │     └─ confidence_score < 0.3 → ข้าม (ไม่ใช่ประกาศ)
       │
       ├─ Download รูปภาพ (สูงสุด 10 รูป, timeout 15s/รูป)
       │     └─ Upload → Supabase Storage /lead-images/{leadId}/
       │
       └─ Insert lead → Supabase `leads` table
```

---

# Database Schema

ดูใน `src/schema.sql` สำหรับ DDL เต็ม

Core table: `leads`
- `post_url` (unique) — dedup key
- ฟิลด์ property, contact, AI enrichment
- `image_urls` (text[]) — public URLs ของรูปใน Supabase Storage
- `lead_status` default 'new'

Storage bucket: `lead-images` (public)

---

# วิธีเริ่มใช้งาน

```bash
git clone ...
cd find-property
npm install
cp .env.example .env.local
# 1. รัน src/schema.sql ใน Supabase SQL Editor
# 2. สร้าง bucket "lead-images" (public) ใน Supabase Storage
npm run setup:db    # alternative: สร้าง bucket อัตโนมัติ
vercel deploy       # deploy ไป production
```

Environment Variables: `APIFY_API_KEY`, `APIFY_ACTOR_ID`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROUP_URLS` (JSON array)

---

# Future Phases

## Phase 2

- Multi-source collection
- DDProperty
- LivingInsider
- Developer Websites
- Agent Websites

## Phase 3

- CRM Dashboard
- Search
- Filters
- Assignment
- Follow-up

## Phase 4

- LINE Notifications
- Sales Assignment
- Automatic Reminders

## Phase 5

- AI Calling Assistant
- Availability Checking
- Contact Verification

## Phase 6

- Google Satellite Detection
- Warehouse Detection
- AI Lead Discovery

---

# Long-Term Vision

The system should become a centralized Property Lead Intelligence Platform where every discovered property from any source is automatically:

1. Collected
2. Captured
3. Understood by AI
4. Validated
5. Stored
6. Assigned
7. Followed up

This eliminates repetitive manual work and allows the sales team to focus on contacting property owners instead of collecting data.
