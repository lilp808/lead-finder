# FindProperty — คู่มือสำหรับทีม Backend (ทดสอบผ่านหน้า Web HTML)

> เอกสารนี้ใช้ประกอบหน้า HTML ทั้งหมดในโฟลเดอร์ `scripts/` เพื่อให้ทีม Backend เข้ามาทดสอบ
> ดูการทำงานของเว็บ แล้วนำไปสร้าง/ปรับปรุงระบบ Backend ให้ครบตามที่หน้าเว็บเรียกใช้

---

## 1. ภาพรวมระบบ

- หน้าเว็บทั้งหมดเป็น **HTML เดี่ยว (static) + JavaScript** อยู่ภายใต้โฟลเดอร์ `scripts/`:
  - `login.html` — หน้าเข้าสู่ระบบ (`/login`)
  - `test.html` — หน้า Config / Dashboard (`/`) ← หน้าหลัก
  - `lead.html` — หน้า Leads (`/lead`)
  - `result.html` — หน้า Result Leads (`/result`)
  - `logs.html` — หน้า Collect Logs (`/logs`)
- ทุกหน้าโหลดข้อมูลผ่าน `fetch` ไปยัง API `/api/*` (แบบ relative — `API_BASE = ''`)
- **ระบบยิง API เดียว**: ทุก endpoint ถูก dispatch จาก `api/index.js` ผ่าน `vercel.json` rewrites
- **การรับ/ส่งข้อมูล**: ทุก API คืน JSON; รูปแบบ error เป็น `{ "error": "ข้อความ" }`

### 1.1 Authentication (ระบบ Login)

- หน้าเว็บทุกหน้า (ยกเว้น `/login`) ตรวจ cookie ชื่อ **`fp_session`** ก่อนแสดงผล
  - ถ้ายังไม่ login → redirect ไป `/login`
- ผู้ใช้/รหัสผ่าน มาจาก env: `LOGIN_USERNAME` / `LOGIN_PASSWORD`
- Session token = `base64url(timestamp) + "." + HMAC-SHA256(username:timestamp)`
- Cookie: `HttpOnly`, `Path=/`, `SameSite=Lax`, อายุ 7 วัน (`Max-Age=604800`)

| Endpoint | Method | หน้าที่ | คำอธิบาย |
|---|---|---|---|
| `/api/login` | POST | login.html | รับ `{ username, password }` → สำเร็จ 200 `{ ok: true }` + set cookie / ไม่สำเร็จ 401 `{ error: "invalid_credentials" }` |
| `/logout` | GET | nav ทุกหน้า | ลบ cookie → redirect `/login` |

### 1.2 ตาราง API ทั้งหมดที่หน้าเว็บเรียกใช้

| Method | Endpoint | ใช้จากหน้า | คำอธิบาย |
|---|---|---|---|
| GET | `/api/sources` | Config, Leads | รายการ source ทั้งหมด |
| POST | `/api/sources` | Config | เพิ่ม source |
| PATCH | `/api/sources/:id` | Config | แก้ไข / toggle source |
| DELETE | `/api/sources/:id` | Config | ลบ source |
| GET | `/api/schedules` | Config | รายการ schedule |
| POST | `/api/schedules` | Config | เพิ่ม schedule |
| PATCH | `/api/schedules/:id` | Config | toggle / แก้ schedule |
| DELETE | `/api/schedules/:id` | Config | ลบ schedule |
| GET | `/api/collect` (มี/ไม่มี `?sourceId=`) | Config | รัน pipeline เก็บข้อมูล, คืน `{ steps: [] }` |
| GET | `/api/leads` | Leads | ลิสต์ lead + filter + paginate |
| GET | `/api/leads/:id` | Leads, Result | รายละเอียด lead |
| PATCH | `/api/leads/:id` | Leads (Workflow tab) | แก้ lead |
| PATCH | `/api/leads` | (ยังไม่ได้ใช้จาก UI) | bulk update หลาย lead |
| GET | `/api/leads/export` | Leads (CSV) | ส่งไฟล์ CSV |
| GET | `/api/result-leads` | Result | ลิสต์ result leads |
| GET | `/api/logs` | Logs | ลิสต์ประวัติการรัน |
| GET | `/api/logs/:id` | Logs | ขั้นตอน (steps) ของแต่ละรอบ |

---

## 2. หน้า Login — `scripts/login.html` (`/login`)

**วัตถุประสงค์**: ให้ผู้ใช้ล็อกอินก่อนเข้า Dashboard

### UI
- ฟอร์ม 2 ช่อง: `username`, `password` (บังคับกรอกทั้งคู่ — ใช้ `novalidate` แล้วเช็คเอง)
- ปุ่ม **เข้าสู่ระบบ** (ตอน submit จะ disabled ระหว่างรอ)
- กล่อง error สีแดง (ค่าเริ่มต้นซ่อน) — แสดง 3 กรณี:
  - กรอกไม่ครบ → "กรุณากรอก username และ password"
  - login ไม่สำเร็จ → "Username หรือ Password ไม่ถูกต้อง"
  - fetch error → "เกิดข้อผิดพลาด กรุณาลองใหม่"

### API
```
POST /api/login
Content-Type: application/json

Request body:  { "username": "...", "password": "..." }

Success:       200 { "ok": true }  +  Set-Cookie: fp_session=...
Failed:        401 { "error": "invalid_credentials" }
```

- หน้าเช็ค `res.ok && data.ok` → ถึงจะ redirect ไป `/`
- Backend ควร validate ว่ามี env `LOGIN_USERNAME`/`LOGIN_PASSWORD` ตั้งไว้ (ถ้าไม่มี = ไม่มีสิทธิ์ login)

---

## 3. หน้า Config / Dashboard — `scripts/test.html` (`/`)

**วัตถุประสงค์**: จัดการแหล่งข้อมูล, กำหนดเวลารัน, และกดรัน Collect

มี 3 การ์ด: **Sources**, **Schedule**, **Collect**

### 3.1 การ์ด Sources (จัดการแหล่งข้อมูล)

#### UI
- ปุ่ม **Refresh** — โหลดรายการใหม่
- ปุ่ม **Add Source** — เปิดฟอร์มเพิ่ม (เลือก platform, ชื่อ, URL, จำนวนโพสต์, AI Provider/Model)
- แต่ละแถว: หมายเลข, ชื่อ + URL, badge platform, badge จำนวนโพสต์, badge AI model, badge **On/Off (คลิกได้)** , ปุ่มแก้ไข, ปุ่มลบ (confirm ก่อน)
- **Edit** → เปิดฟอร์มเดิมพร้อมค่าปัจจุบัน → Save = PATCH
- เมื่อเลือก platform = `ddproperty` → **ซ่อนช่อง AI** (DD ไม่ใช้ AI)

#### API
| Method | URL | Body / Params | Success |
|---|---|---|---|
| GET | `/api/sources` | — | `200` array ของ source |
| POST | `/api/sources` | `{ platform, label, source_url, results_limit, model_provider, model_name }` | `201` object ที่ insert |
| PATCH | `/api/sources/:id` | เช่น `{ active }`, `{ label, source_url, results_limit, model_provider, model_name }` | `200` object |
| DELETE | `/api/sources/:id` | — | `200 { ok: true }` |

#### โครงสร้าง object ของ source
```jsonc
{
  "id": "uuid",
  "platform": "facebook",          // หรือ "ddproperty"
  "label": "House Group 1",
  "source_url": "https://facebook.com/groups/...",
  "results_limit": 10,
  "active": true,
  "model_provider": "typhoon",     // typhoon | groq (เฉพาะ facebook)
  "model_name": "typhoon-v2.5-30b-a3b-instruct",
  "created_at": "...",
  "updated_at": "..."
}
```

#### Model ที่หน้าเว็บมีให้เลือก (hardcode ฝั่ง frontend)
- `typhoon`: `typhoon-v2.5-30b-a3b-instruct` (Typhoon v2.5 30B), `typhoon-v2.5-7b-instruct` (7B)
- `groq`: `llama-3.3-70b-versatile` (70B), `llama-3.1-8b-instant` (8B fast)

### 3.2 การ์ด Schedule (กำหนดเวลารันอัตโนมัติ)

- แบนเนอร์แจ้ง: "Hobby plan: 1 run/day at 06:00 UTC (13:00 ICT)"
- **Add Schedule**: เลือก `hour` (0–23), `minute` (00/15/30/45), label
- แต่ละแถว: `HH:MM UTC` + label + badge On/Off (คลิกได้) + ปุ่มลบ

| Method | URL | Body | Success |
|---|---|---|---|
| GET | `/api/schedules` | — | `200` array |
| POST | `/api/schedules` | `{ hour, minute, label }` | `201` object |
| PATCH | `/api/schedules/:id` | เช่น `{ active }` | `200` object |
| DELETE | `/api/schedules/:id` | — | `200 { ok: true }` |

- Validation: `hour` 0–23, `minute` 0–59 (ถ้าผิด → 400)
- object: `{ id, hour, minute, label, active, created_at, updated_at }`

### 3.3 การ์ด Collect (รัน pipeline)

#### ลำดับการทำงานฝั่ง frontend
1. `GET /api/sources` → กรอง `active === true`
2. ถ้าไม่มี source active → แสดง error "No active sources configured"
3. วนลูปทีละ source → `GET /api/collect?sourceId=<id>` → ฉาย `data.steps` แบบ real-time

#### Response ของ `/api/collect`
```jsonc
{
  "steps": [
    { "type": "source_start", "status": "running", "label": "...", "limit": 10 },
    { "type": "poll", "status": "ok", "label": "...", "elapsed": 23 },
    { "type": "item", "status": "inserted", "property_type": "warehouse",
      "area": "100 ตรม", "province": "...", "district": "...", "confidence": 0.9, "postUrl": "..." },
    { "type": "summary", "inserted": 3, "duplicates": 1, "low_confidence": 1, "errors": 0, "skipped": 0 }
  ]
}
```

#### ความหมายของ `steps[]` (ตาราง)

| type | status | ข้อความที่แสดง | ฟิลด์สำคัญ |
|---|---|---|---|
| `source_start` | running | `Scraping <label> (limit: N)` | `label, limit/quota` |
| `poll` | ok / (waiting) | `Scrape done (Xs)` / `Waiting... (Xs)` | `label, elapsed` |
| `fetch` | error | `DDProperty fetch error (page N): <msg>` | `page, error` |
| `fetch` | — | `Got N posts (page X of Y)` | `count, page, totalPages, label` |
| `fetched` | — | `DDProperty done — N new, M dup, P pages` | `inserted, duplicates, pagesRead` |
| `dd_skipped` | — | `<label> skipped — <hint>` | `label, count, hint` |
| `platform_skipped` | — | `<label> skipped — <hint>` | `label, count, hint` |
| `source_error` | error | `<label> — <error>` | `label, error` |
| `batch_progress` | running | `Processing batch X/Y` | `batch, total` |
| `time_limit` | — | `Time limit — processed X, skipped Y (next round)` | `processed, skipped` |
| `item_progress` | — | `Processing post X/Y` | `index, total` |
| `item` | inserted | `Saved — <type> · <area> · <province> · <district> (<conf%>)` | `property_type, area, province, district, confidence, title, price, images, postUrl` |
| `item` | duplicate | `Duplicate (already in DB)` (reason `existing_url`) หรือ `Duplicated post (same text & image count)` (reason `repost`) | `reason, matchedUrl, postUrl` |
| `item` | low_confidence | `Not a listing (score: N) — NOT saved` | `score, postUrl` |
| `item` | error | `Error: <msg> — NOT saved` | `error, postUrl` |
| `summary` | — | การ์ดสรุปตัวเลข | `inserted, duplicates, low_confidence, errors, skipped` (ต้องเป็น step สุดท้าย) |

#### สีไอคอนของแต่ละ status
- `inserted` / `ok` = เขียว (check-circle)
- `running` / `polling` / `processing` / `batch_progress` = น้ำเงิน (loader)
- `duplicate` = เหลือง (arrow-right)
- `low_confidence` = ม่วง (triangle)
- `error` / `source_error` = แดง (x-circle)

#### กฎ business ที่ Backend ต้องทำ (จากข้อความใน log)
1. **Dedup (Facebook)**:
   - `existing_url` → `post_url` ซ้ำกับที่มีใน DB แล้ว → ข้าม
   - `repost` → `raw_post_text` เหมือนกันเป๊ะ **และ** จำนวนรูปเท่ากัน → ข้าม, ไม่เรียก AI
2. **low_confidence**: `confidence_score < 0.3` → ทิ้ง (ไม่บันทึก)
3. **Time limit**: Vercel maxDuration 60s → ถ้าใกล้หมด ให้ส่ง step `time_limit` แล้วรันต่อรอบหน้า

---

## 4. หน้า Leads — `scripts/lead.html` (`/lead`)

**วัตถุประสงค์**: แสดงข้อมูลดิบ (leads) ทั้งหมด, ค้นหา/กรอง, ดูรายละเอียด, แก้ไขสถานะ, export CSV

### 4.1 แถบสถิติ (Stats)
- หน้าเรียก `GET /api/leads?limit=1000` แล้ว **นับเองฝั่ง browser**:
  - **Total** = `total`
  - **New** = จำนวน `lead_status === 'new'`
  - **Contacted** = `contacted + interested + not_interested`
  - **Appointment** = จำนวน `appointment`
  - **Closed** = `sold + rented`

### 4.2 Toolbar (ค้นหา/กรอง)
- ช่องค้นหา: `fSearch` — "ค้นหา ชื่อ / โพสต์ / เบอร์ / LINE"
- Dropdown: `fStatus`, `fType` (property_type), `fAgentTeam` (A/B/C/unassigned), `fPlatform`, `fSourceName` (โหลดจาก `/api/sources`)
- ช่อง: `fProvince`
- ปุ่ม: **ค้นหา**, **ล้าง**, **CSV** + ข้อความ "Showing X of Y leads"

### 4.3 API — รายการ leads
```
GET /api/leads?search=...&status=...&property_type=...&province=...
                &source_platform=...&source_name=...&agent_team=...&page=1&limit=20
```

| Param | ความหมาย | หมายเหตุ |
|---|---|---|
| `search` | ค้นหาแบบ contains | ค้นใน `raw_post_text, author_name, contact_name, address, phone_number, line_id` |
| `status` | กรองสถานะ | รองรับ comma-separated เช่น `new,contacted` |
| `property_type` | กรองประเภท | `warehouse`, `factory`, `warehouse_factory`, `showroom & commercial` |
| `province` | จังหวัด | contains (ilike) |
| `source_platform` | แพลตฟอร์ม | `facebook` / `ddproperty` |
| `source_name` | ชื่อ source | เท่ากับ field `source_name` |
| `agent_team` | ทีม | `A`/`B`/`C`; `none` หรือ `unassigned` = `agent_team IS NULL` |
| `page` / `limit` | pagination | หน้าใช้ `limit=20` |

**Response**:
```jsonc
{ "leads": [ /* object lead */ ], "total": 0, "page": 1, "limit": 20, "totalPages": 0 }
```

### 4.4 ฟิลด์ใน lead (ที่การ์ด / modal ใช้)
- `id`, `image_urls` (array), `property_type`, `agent_team`, `sale_price`, `rent_price`,
  `pricing_area_sqm` / `building_area_sqm` / `land_area_sqm`, `lead_status`, `source_platform`,
  `province`, `district`, `sub_district`, `contact_name`, `phone_number`, `line_id`, `whatsapp`, `wechat`,
  `owner_or_agent`, `land_area`, `building_area`, `ai_summary`, `confidence_score`, `ai_tags`,
  `google_maps_url`, `post_url`, `source_url`, `source_name`, `notes`, `assigned_to`,
  `posted_at`, `collected_at`, `raw_post_text`, `listing_status`

- ตรม ที่แสดง = `pricing_area_sqm` ?? `building_area_sqm` ?? `land_area_sqm`
- สถานะ 8 แบบ (สี badge ต่างกัน): `new, contacted, interested, not_interested, appointment, sold, rented, invalid`

### 4.5 ปุ่มในแต่ละการ์ด

#### (ก) Share — สร้างข้อความโฆษณา
- `GET /api/leads/:id` → frontend ประกอบข้อความ share แล้วให้ copy:
```
📌 <property_type> <listing_status>
💰 Sale: ฿X     /     💰 Rent: ฿X/mo
📐 Land: ...     📐 Building: ...
📍 province / district / sub_district
👤 contact_name
📞 phone | LINE: x | WA: x
🏢 owner | agent | unknown
💬 ai_summary
🔗 post_url
———
Powered by FindProperty Lead Intelligence
```

#### (ข) View — modal 3 แท็บ
1. **Original Post**: slider รูป (`image_urls`) + ข้อความ `raw_post_text` + ปุ่มเปิดโพสต์ต้นทาง
2. **Details**: Listing Info / Contact / AI Analysis / Internal + รูปทั้งหมด (คลิกเปิดใหม่)
3. **Workflow** = form แก้ไข (ดูข้อ 4.6)

### 4.6 API — แก้ไข lead
```
PATCH /api/leads/:id
Body: { lead_status, agent_team, assigned_to, province, district, sub_district, google_maps_url, notes }
```
- ส่งเฉพาะฟิลด์ที่ต้องการแก้ (ฟิลด์ที่ไม่อยู่ใน body = ไม่เปลี่ยน)
- **กฎสำคัญ**:
  1. ถ้าส่ง `province` / `district` / `sub_district` **และไม่ส่ง `agent_team`** → backend ต้อง **คำนวณ `agent_team` ใหม่** จากตำแหน่ง (rule-based ดูหัวข้อ 7)
  2. ถ้าแก้ `google_maps_url` → ต้อง **sync ไปที่ `result_leads`** (`result_leads.google_maps_url` ตาม `lead_id`)
- `agent_team` ถ้าส่งค่าว่าง → กลายเป็น `null`

> มี API bulk ด้วย: `PATCH /api/leads` body `{ ids: [...], updates: { lead_status, notes, assigned_to, agent_team } }` — หน้า UI ยังไม่ได้ใช้ แต่ Backend ควรมี (กรองได้เฉพาะฟิลด์ที่อนุญาต)

### 4.7 Export CSV
```
GET /api/leads/export?<filters เดียวกับ /api/leads>
```
- Export **ทั้งหมด** (ไม่มีการ cut page/limit)
- Response: `text/csv; charset=utf-8` + BOM `\uFEFF` (กัน Excel อ่านภาษาไทยเพี้ยน)
- Header 32 คอลัมน์ (เรียงตามนี้):
```
id, post_url, source_url, source_platform, source_config_id, source_name,
author_name, posted_at, collected_at, property_type, listing_status,
rent_price, sale_price, land_area, building_area, province, district,
sub_district, address, google_maps_url, contact_name, phone_number,
line_id, whatsapp, owner_or_agent, lead_status, confidence_score,
lead_score, ai_summary, assigned_to, agent_team
```
- `Content-Disposition: attachment; filename="findproperty-leads-YYYY-MM-DD.csv"`

---

## 5. หน้า Result Leads — `scripts/result.html` (`/result`)

**วัตถุประสงค์**: แสดงเฉพาะ lead ที่ "สมบูรณ์ พร้อมส่ง Agent" (snapshot ใน `result_leads`)

### 5.1 Toolbar
- ค้นหา: "ค้นหา address / จังหวัด / แหล่งที่มา"
- Dropdown: `teamFilter` (ทุกทีม/A/B/C/ยังไม่มีทีม), `platformFilter` (facebook/ddproperty)
- ปุ่ม: **ค้นหา**, **รีเฟรช** (Enter ในช่องค้นหา = กดค้นหา; พิมพ์แล้วลบจนว่าง = รีโหลดอัตโนมัติ)

### 5.2 API
```
GET /api/result-leads?search=...&agent_team=...&source_platform=...&page=1&limit=12
```
- `search` ค้นหา (ilike) ใน: `address, post_url, source_name, ai_summary, province`
- `agent_team=none` → `agent_team IS NULL`
- Response:
```jsonc
{ "results": [ /* object result_lead */ ], "total": 0, "page": 1, "limit": 12, "totalPages": 0 }
```

### 5.3 ฟิลด์ในการ์ด
- `image_urls[0]` + จำนวนรูป, `property_type`, `agent_team`, `rent_price` / `sale_price`,
  `pricing_area_sqm` ?? `building_area_sqm` ?? `land_area_sqm`, `listing_status`,
  `province` / `district` / `sub_district`, `address`, `ai_summary`,
  `google_maps_url`, `post_url`, `source_platform`, `source_name`, **`lead_id`**
- ราคา: ถ้ามี `rent_price` → "เช่า X"; ถ้าไม่มีแต่มี `sale_price` → "ขาย X" (frontend ฟอร์แมต "1.2 ล." เมื่อ ≥ 1,000,000)

### 5.4 ปุ่ม View / Share
- ใช้ **`lead_id`** จาก result → `GET /api/leads/:lead_id` (ข้อมูลเต็มจากตาราง `leads`)
- แสดง modal (slider รูป + รายละเอียด) และข้อความ share เหมือนหน้า Leads
- ถ้าไม่มี `lead_id` → toast "No source lead for this result"

### 5.5 เบื้องหลัง (ที่ Backend ต้องรู้)
- `result_leads` ถูกสร้างโดย **Result Leads workflow** เมื่อ lead มีข้อมูลครบ:
  มี SQM (`pricing_area_sqm`/`land_area_sqm`/`building_area_sqm`), `province`+`district`+`sub_district`,
  ≥1 รูป, ราคา, และ `agent_team`
- snapshot เข้า `result_leads` โดย key เฉพาะ `lead_id` (upsert)
- ระบบ **dedup + merge**: หา candidate (ตำแหน่งเดียวกัน + SQM ตรงกัน) → AI เปรียบเทียบรูป → ถ้าเป็นที่เดียวกัน + confidence ≥ 0.7 → merge (ลบฝั่งซ้ำออกจาก `result_leads`, ตั้ง `leads.lead_status='merged'`)
- เมื่อแก้ `google_maps_url` ที่หน้า Leads → ต้อง sync มาที่ `result_leads` ด้วย (ดูหัวข้อ 4.6)

---

## 6. หน้า Collect Logs — `scripts/logs.html` (`/logs`)

**วัตถุประสงค์**: แสดงประวัติการรัน Collect (`lead_logs`) — หนึ่งการ์ด = หนึ่งรอบ

### 6.1 API
```
GET /api/logs?page=1&limit=20&search=...
GET /api/logs/:id
```
- `search` → ค้นหา `label` (ilike) เช่น "2026-08-07" เพื่อหาการรันของวันนั้น
- sort ตาม `ran_at` desc
- Response:
```jsonc
// /api/logs
{ "logs": [ { "id", "label", "ran_at", "trigger", "summary": { "inserted", "duplicates", "low_confidence", "errors", "total" } } ],
  "total": 0, "page": 1, "limit": 20, "totalPages": 0 }

// /api/logs/:id  — ต้อง parse field steps (อาจเป็น string JSON)
{ "log": { "id", "label", "ran_at", "trigger", "summary": {...}, "steps": [ ... ] } }
```

### 6.2 UI
- แต่ละการ์ด: `label` (ชื่อ = เวลา), `trigger`, chips สรุป: `inserted` (เขียว) / `duplicates` (เหลือง) / `low_confidence` (ฟ้า) / `errors` (แดง) / `total`
- คลิกการ์ด → expand → ฉาย `steps` ทีละบรรทัด

### 6.3 Step types ทั้งหมดที่รองรับ (รวมของ workflow)
- เหมือนหน้า Collect: `source_start, poll, fetch, fetched, dd_skipped, platform_skipped, source_error, batch_progress, time_limit, item_progress, item, summary, error`
- **ขั้นของ workflow (Result Leads)**:
  | type | status | ข้อความ | ฟิลด์ |
  |---|---|---|---|
  | `workflow_check` | `ready` | "ข้อมูลครบ พร้อมส่ง Agent (Team X)" | `agent_team` |
  | `workflow_check` | อื่น | "ข้อมูลไม่ครบ — missing: ..." | `missing[]` |
  | `workflow_check` | `time_limit` | "ข้ามไป (ใกล้หมดเวลา)" | — |
  | `workflow_dedup` | `candidate` | "พบรายการต้องสงสัยซ้ำ (Location+SQM ตรง)" | `matchedUrl` |
  | `workflow_dedup` | `unverified` | "ตรวจภาพไม่ได้ — บันทึกไว้รอ review" | `error` |
  | `workflow_dedup` | `error` | "dedup error" | `error` |
  | `workflow_vision` | `same`/`different` | "AI เทียบภาพ → เป็นที่เดียวกัน/คนละที่ (N%)" | `confidence` |
  | `workflow_merged` | — | "MERGED — เก็บรายการ X, ลบฝั่งซ้ำ" | `winner, mergedInto` |
  | `workflow_ready` | — | "บันทึก result_leads แล้ว (id: ...)" | `resultLeadId` |
- step ที่มี `postUrl` → แสดงเป็นลิงก์ใต้ข้อความ
- สี: ok/inserted/ready/same/merged=เขียว, running/polling=น้ำเงิน, error/source_error=แดง, duplicate/candidate=เหลือง, low_confidence/incomplete/unverified/different=ฟ้า

---

## 7. กฎ business ที่ Backend ต้องรู้

### 7.1 Enum ต่าง ๆ
| Field | ค่าที่เป็นไปได้ |
|---|---|
| `lead_status` | `new, contacted, interested, not_interested, appointment, sold, rented, invalid` |
| `property_type` | `warehouse, factory, warehouse_factory, showroom & commercial` (+ "Other" ใน dropdown ค้นหา) |
| `listing_status` | `rent, sale, both` |
| `owner_or_agent` | `owner, agent, unknown` |
| `agent_team` | `'A'`, `'B'`, `'C'`, หรือ `null` |

### 7.2 Agent Team (A/B/C) — rule-based ไม่ใช้ AI
คำนวณจาก `province` / `district`:
- **A**: สมุทรปราการ, ฉะเชิงเทรา, สมุทรสาคร + เขตกทม. (บางขุนเทียน, บางนา, ลาดกระบัง, หลักสี่, พระโขนง, ประเวศ, สะพานสูง, สวนหลวง)
- **B**: ชลบุรี, ระยอง
- **C**: พระนครศรีอยุธยา, ปทุมธานี, นนทบุรี, นครปฐม + เขตกทม. (บางกะปิ, บางเขน, บึงกุ่ม, จตุจักร, ดอนเมือง, คันนายาว, คลองสามวา, หลักสี่, ลาดพร้าว, มีนบุรี, สายไหม, วังทองหลาง)
- Bangkok → match อำเภอก่อน; ถ้าเป็นจังหวัด/อำเภอที่ไม่รู้จัก → `null` (รอ review, **ห้ามเดา**)
- Recompute เมื่อแก้ตำแหน่ง (หน้า Leads Workflow tab)

### 7.3 Dedup (Facebook)
- Stage 1: `post_url` ซ้ำ → duplicate
- Stage 2: `raw_post_text` เหมือนกันเป๊ะ **และ** จำนวนรูปเท่ากัน → duplicate (reason `repost`, ไม่เรียก AI)

### 7.4 เกณฑ์ผ่าน/ตก
- `confidence_score < 0.3` → ตก (low_confidence) ไม่บันทึก

### 7.5 ตารางข้อมูลหลัก (DB)
| ตาราง | ใช้เก็บ | key หลัก |
|---|---|---|
| `source_configs` | แหล่งข้อมูล (หน้า Config) | `id` |
| `cron_schedules` | เวลารันอัตโนมัติ (หน้า Config) | `id` |
| `leads` | ข้อมูลดิบทุกโพสต์ที่เก็บได้ (หน้า Leads) | `id` (uuid) |
| `result_leads` | snapshot lead ที่สมบูรณ์ พร้อมส่ง agent (หน้า Result) | `lead_id` (unique) |
| `lead_logs` | ประวัติการรัน + steps (หน้า Logs) | `id` |

> หมายเหตุ: `result_leads.lead_id` ชี้กลับไปที่ `leads.id` — หน้า Result ดึงรายละเอียดเต็มผ่าน `/api/leads/:lead_id`

---

## 8. วิธีทดสอบสำหรับทีม Backend

1. ตั้งค่า env: `LOGIN_USERNAME`, `LOGIN_PASSWORD` (และตัวอื่นตาม `AGENTS.md`)
2. รัน dev: `npm run dev` → เปิด `http://localhost:3000`
3. เข้า `/login` → login → ตรวจว่า redirect ไป `/` ถูกต้อง
4. ทดสอบหน้า Config:
   - เพิ่ม source (facebook และ ddproperty) → ตรวจว่าโผล่ในรายการ → toggle On/Off → แก้ไข → ลบ
   - เพิ่ม schedule → toggle → ลบ
   - กด **Collect Now** → ดูว่า log ฉาย step ต่าง ๆ ถูกต้อง (รวม summary)
5. ทดสอบหน้า Leads: ค้นหา/กรอง/ไปหน้า 2/ดู View (3 แท็บ)/Share/copy/แก้ไข Workflow/Export CSV
6. ทดสอบหน้า Result: ค้นหา/กรองทีม/platform/View/Share
7. ทดสอบหน้า Logs: ค้นหา/expand ดู steps (รวม workflow steps)
8. ทดสอบ logout → กลับไป login
