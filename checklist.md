# Property Lead Platform — Implementation Checklist

อ้างอิงจาก `plan.md` + สถานะปัจจุบัน

## 階段 0: Source Abstraction

- [x] Rename `group_url` → `source_url` ใน DB
- [x] เพิ่ม column `source_platform`, `screenshot_urls`, `assigned_to`, `assigned_at`, `call_history`, `appointment_history`, `roof_gps`, `roof_screenshot_url`
- [x] Refactor code: เปลี่ยน `group_url` → `source_url` ใน insert pipeline
- [x] Refactor code: insert `source_platform` = `'facebook'` ใน collect + webhook
- [x] Refactor code: insert `screenshot_urls` = `[]` (array ว่าง) ใน collect + webhook
- [x] อัปเดต `src/schema.sql` ให้ตรงกับ migration

## ระบบ Config แหล่งข้อมูล (Web UI)

- [x] สร้างตาราง `source_configs` ใน `src/schema.sql`
- [x] สร้าง `api/sources/index.js` — GET (list) + POST (add)
- [x] สร้าง `api/sources/[id].js` — PATCH (toggle/edit) + DELETE
- [x] Refactor `api/collect.js` — อ่าน active sources จาก DB, loop scrap ทุกกลุ่มตาม limit ของมัน
- [x] Refactor `scripts/scrape.mjs` — อ่าน active sources จาก DB แทน `GROUP_URLS`
- [x] อัปเดต `scripts/dev.mjs` — routing สำหรับ `/api/sources/*`
- [x] UI ใน `scripts/test.html` — ตาราง sources, toggle เปิด/ปิด, add source form
- [x] ลบ `GROUP_URLS` จาก `.env.example` และ `AGENTS.md`

## 階段 1: ddproperty Scraper

### Core Scraper
- [ ] สร้าง `src/sources/ddproperty.js` — class/fn สำหรับ scrape
- [ ] search listings ตาม filter (province, type: warehouse/factory/land)
- [ ] extract ฟิลด์: `url`, `title`, `price`, `area`, `location`, `description`, `contact`, `images`
- [ ] upload รูปประกาศไป Supabase Storage

### Integration
- [ ] สร้าง `api/fetch-ddproperty.js` — endpoint สำหรับ manual trigger
- [ ] เพิ่ม cron ใน `vercel.json` สำหรับ ddproperty (ถ้าต่างเวลา)
- [ ] เพิ่ม `DD_사용자` env vars (ถ้าต้อง login)

## 階段 2: LINE Notification

- [ ] สร้าง `src/lib/line.js` — LINE Messaging API client
- [ ] env: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID`
- [ ] สร้าง lead card message template (property type, price, location)
- [ ] ส่ง notification เมื่อ insert lead สำเร็จ (ทั้ง sync + async)
- [ ] fallback: ถ้า LINE ล้มเหลว ไม่กระทบ pipeline หลัก

## 階段 3: Lead Card UI

### Backend
- [ ] สร้าง `pages/api/leads.js` — API list + filter + search
- [ ] สร้าง `pages/api/leads/[id].js` — GET lead detail

### Frontend
- [ ] สร้าง `pages/_app.js` — layout + simple auth (ถ้าต้องการ)
- [ ] สร้าง `pages/index.js` — lead list dashboard
  - filter: source_platform, property_type, province, lead_status
  - search: text search
  - sort: newest first
- [ ] สร้าง `pages/leads/[id].js` — single lead card
  - รูปประกาศ (listing images)
  - property details, AI summary, contact
  - status management (assign, follow-up, close)
  - Google Maps link (จาก location_est/GPS)

## 階段 4: Google Sheets Sync

- [ ] `googleapis` package
- [ ] สร้าง `src/lib/google-sheets.js`
- [ ] auth ด้วย service account
- [ ] sync เมื่อ insert lead (หรือ batch sync ตาม cron)
- [ ] env: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`

## 階段 5: Lead Assignment + Workflow

- [ ] เพิ่ม column `assigned_to text` (salesperson name/ID)
- [ ] เพิ่ม column `assigned_at timestamptz`
- [ ] สร้าง `pages/api/leads/[id]/assign.js` — assign salesperson
- [ ] สร้าง `pages/api/leads/[id]/status.js` — อัปเดต lead_status
- [ ] เพิ่ม `call_history jsonb` หรือ `appointment_history jsonb` column
- [ ] UI สำหรับเปลี่ยน status + assign

## 階段 6: GPS / Roof Hunting Support

- [ ] Populate `location_est` — geocode จาก address ด้วย Google Maps API หรือ open source
- [ ] env: `GOOGLE_MAPS_API_KEY`
- [ ] ฟีเจอร์ Roof Hunting (optional — partially automatable):
  - UI ให้ admin เลือก lead → เปิด Google Satellite
  - บันทึก GPS, screenshot rooftop
  - column: `roof_gps point`, `roof_screenshot_url text`

## 階段 7: Agent Websites / Developer Websites / LivingInsider

- [ ] สร้าง source module pattern (เหมือน ddproperty)
- [ ] `src/sources/livinginsider.js`
- [ ] `src/sources/agent-website.js`
- [ ] `src/sources/developer-website.js`
- [ ] สำหรับ site ที่ต้อง login: ใช้ Apify หรือ Playwright ที่ config cookies ได้

## 階段 8: Advanced

- [ ] LINE Notify แจ้ง "สรุปประจำวัน": จำนวน lead ที่เข้าใหม่, จำแนกตามประเภท
- [ ] Monthly reminder — ส่ง LINE message เตือน salesperson เรื่อง lead ที่ยังไม่ progress
- [ ] AI phone call (optional) — ต่อสายหาเจ้าของทรัพย์, ยืนยันสถานะ, สรุปบทสนทนา

---

## Priority Matrix

| Priority | Task | Effort | Impact |
|---|---|---|---|
| P0 | Source Abstraction | medium | ต้องทำก่อนเพิ่ม source |
| P0 | ddproperty Scraper | large | source แรกนอก Facebook |
| P1 | Lead Card UI | large | admin ใช้งานจริง |
| P1 | LINE Notify | small | notification |
| P2 | Google Sheets Sync | small | reporting |
| P2 | Lead Assignment | medium | workflow |
| P3 | GPS / Roof Hunting | medium | feature |
| P3 | LivingInsider + อื่นๆ | large | expansion |

---

## DB Schema ที่ต้องเพิ่ม/เปลี่ยน (รวมทุก task)

```sql
ALTER TABLE leads RENAME COLUMN group_url TO source_url;
ALTER TABLE leads ADD COLUMN source_platform text NOT NULL DEFAULT 'facebook';
ALTER TABLE leads ADD COLUMN screenshot_urls text[];
ALTER TABLE leads ADD COLUMN assigned_to text;
ALTER TABLE leads ADD COLUMN assigned_at timestamptz;
ALTER TABLE leads ADD COLUMN call_history jsonb;
ALTER TABLE leads ADD COLUMN appointment_history jsonb;
ALTER TABLE leads ADD COLUMN roof_gps point;
ALTER TABLE leads ADD COLUMN roof_screenshot_url text;
```
