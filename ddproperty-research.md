# DD Property Scraper ที่ feasibility research

> URL ทดสอบ
> `https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&page=1&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true`

## สรุปสั้น

- **GET ได้** — HTTP 200, คืน HTML (Next.js SSR) ~1.1 MB
- **เงื่อนไขสำคัญ**: ต้องส่ง User-Agent ของเบราว์เซอร์เต็ม (Chrome) + `sec-ch-ua` + `Accept-Language`
  - ถ้า UA สั้น/เป็น bot → โดน **Cloudflare challenge** คืนหน้า "Just a moment..." ขนาด ~6 KB
- ไม่ต้อง login, ไม่ต้อง Cookie — ข้อมูล listing **ฝังครบใน `__NEXT_DATA__`** (JSON ใน HTML)
- ผลลัพธ์จริง: **2,815 ยูนิต** (Warehouse/Factory ให้เช่า ทั้งประเทศ), หน้าแรกได้ 20 listing, ทั้งหมด **141 หน้า**

## วิธีการขอ (curl)

```bash
curl -L \
  -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  -H 'sec-ch-ua: "Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"' \
  -H "Accept-Language: en-US,en;q=0.9" \
  "https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&page=1&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true"
```

- สลับหน้า: เปลี่ยน `page=2`, `page=3` … จนถึง 141 (สลับ `page` ใน `paginationData`)
- เปลี่ยนประเภท/ตลาด: `&propertyTypeGroup=C&propertyTypeCode=WAR` (C = commercial, WAR = warehouse), ให้เช่า `listingType=rent`
- หมายเหตุ: เสิร์ชนี้ปิดผลนับก่อนแต่จำนวนจริง consistent ระหว่าง `meta description`, `resultCount`, `paginationData.totalPages`
  (141 × 20 = 2820 ≈ 2815 — หน้าสุดท้ายเหลือ 15 ยูนิต)

## โครงสร้างข้อมูลในหน้า (Next.js SSR)

หน้าเป็น Next.js build `consumerweb-search-*` มีแท็ก:

```html
<script id="__NEXT_DATA__" type="application/json" nonce="..." crossorigin="anonymous">
```

(เจอใน HTML ได้ด้วย regex ที่ยอมรับ attribute `nonce`/`crossorigin`)

### ตำแหน่งข้อมูลสำคัญ (`props.pageProps.pageData`)

| Path | ความหมาย |
|---|---|
| `.resultCount` | ยอดรวม (2815) |
| `.data.listingsData` | **Array 20 listings** ต่อหน้า |
| `.data.paginationData` | `currentPage`, `totalPages` (141), `baseUrl`, `folder`, `queryString` |
| `.data.searchFilterData` | ตัวกรองทั้งหมด (25 filters) |
| `.pageSlug`, `.searchParams` | ตัวกรองที่ใช้ |
| `.locale`, `.region`, `.marketplace` | th, th, pg |

### ตัวอย่าง crawl ไปหน้า 2 (id ต่าง = pagination ทำงาน)

- page=2 → `paginationData.totalPages:141, currentPage:2`, listingsData[0].listingData.id = `500368385`

## Fields ของแต่ละ listing (`listingsData[i].listingData`)

จับได้จาก listing ตัวอย่าง (id `10711268`):

| Field | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| `id` | `10711268` | primary key |
| `url` | `https://www.ddproperty.com/en/property/โกดัง-...-for-rent-10711268` | เชื่อมจาก id ได้ |
| `localizedTitle` | `โกดัง บางใหญ่ บางบัวทอง, Nonthaburi` | ชื่อ/หัวเรื่อง |
| `fullAddress` | `กาญจนาภิเษก (หมายเลข9), Phimonrat, Bang Bua Thong, Nonthaburi` | |
| `shortAddress` | `Phimonrat, Bang Bua Thong, Nonthaburi` | |
| `price.value` / `.pretty` / `.currency` / `.localeStringValue` | `124020` / `฿124,020 /mo` / `THB` / `124020` | |
| `pricePerArea.localeStringValue` | `฿147.12 / sqm` | |
| `psfText` | `฿77.51 / sqm` | |
| `floorArea` | `843` | sqm |
| `area.localeStringValue` | `1,600 sqm (land)` | |
| `bedrooms` / `bathrooms` | `0` / `0` | (warehouse = 0) |
| `additionalData.tenure` | `L` | Leasehold |
| `additionalData.areaText/districtText/regionText` | `Phimonrat` / `Bang Bua Thong` / `Nonthaburi` | + code `TH120407` ฯลฯ |
| `typeText` / `subTypeText` / `typeGroup` | `For Rent` / `Warehouse/Factory` / `C` | |
| `statusCode` | `ACT` | Active |
| `postedOn.text` / `.unix` | `5 Aug 2026` / `1785900159` | ใช้ unix เป็น date ได้ |
| `recency.text` | `Listed on Aug 05, 2026 (2h ago)` | |
| `thumbnail` | `https://th1-cdn.pgimgs.com/listing/10711268/...V550/...` | ภาพหลัก |
| `mediaCarousel.previewMedia.images.items[]` | Array[40] `{src, caption}` | **ภาพทั้งหมด** (URL CDN) |
| `listingFeatures[]` | `{text, dataAutomationId}` | เช่น พื้นที่/ขนาด |
| `badges[]` | `{text, name}` | เช่น `Warehouse/Factory` |
| `agent.id/name/agencyId/profileUrl/avatar.src` | `1292075` / `วิชญา ...` / `/en/agent/...` | ตัวแทนขาย |
| `isVerified` / `agent.isAgentVerified` | `false` / `true` | |
| `products.is*` (featured/boost/promote stream) | `isTurbo:"true"` ฯลฯ | สถานะโปรโมชัน |
| `isOfficialListing` / `isDeveloperListing` | `true` / `false` | |

### รูปภาพ (CDN / รายละเอียด)

- Thumbnail: `https://th1-cdn.pgimgs.com/listing/{id}/UPHO.{photoId}.V550/{slug}`
- ภาพใหญ่: เปลี่ยน `V550` → `V800` หรือได้จาก `mediaItems[].text` (จำนวนภาพ) + `previewMedia.images.items[].src`
- Media ชนิดอื่น (มีได้แต่ตัวอย่างนี้ว่าง): `floorPlans`, `sitePlans`, `videos`, `virtualTours`

## JSON-LD (สคีมา SEO — มีในหน้าแรก)

1. `BreadcrumbList` — breadcrumb
2. `RealEstateListing` → `mainEntity: ItemList` → `itemListElement[]` — รายการ 20 ยูนิตย่อๆ
   แต่ละตัว: `{position, item:{@type:RealEstateListing, datePosted, url, spatial:{name, property}}}` —
   เหมาะเป็น "สัญญาณ" เบาๆ แต่ **ข้อมูลไม่ครบ** (ไม่มีราคา/พื้นที่) ต้องใช้ `__NEXT_DATA__` ดีกว่า
3. `ProfessionalService` — ข้อมูลบริษัท PG

## ข้อควรระวัง / ความเสี่ยง

- **Cloudflare**: ความสำเร็จขึ้นกับ UA ที่ถูกต้อง + header. เห็นครั้งเดียวถูก ครั้งเดียว 6KB challenge แปลว่าไวต่อ UA มาก
  - ทำซ้ำบ่อยๆ ระวัง rate-limit. ถ้าโดน challenge ต้องมี fallback (headless browser)
- **จำนวนคำขอ**: 141 หน้า × 1 request = เพื่อ data ทั้งตลาด warehouse/เช่า. พิจารณา filter จังหวัด/อำเภอเพื่อเล็กลง
- `locale=th` กับ `en` ให้ field เดียวกันแต่ text ต่างภาษา (`localizedTitle`)
- เว็บเป็นฝั่งของ PropertyGuru (AllProperty Media) — ตรวจ legal/robots ของเว็บจริงก่อนใช้งาน production
- ID เป็นตัวเลขถาวร → ใช้เป็น `source_post_id` สำหรับ dedup ได้ (เหมือน pipeline Facebook)

## ข้อเสนอสำหรับ pipeline ที่มีอยู่

แหล่งข่าวใหม่ pluggable ได้โดยไม่แตะ core pipeline:
- แหล่ง (source): URL base สำหรับ warehouse/เช่า (หรือหลาย filter)
- DTO mapper: `listingsData[i].listingData` → schema กลาง (price, area, title, address, images[], agent, date=postedOn.unix)
- CDN image → ผ่าน `src/lib/pg-image` (fetch & upload Supabase bucket `lead-images`) เหมือนที่ทำกับ Facebook
- Dedup: `id` + source
- AI extraction: ใช้ prompt ทั่ว ๆ ไปกับ `fullAddress`+`listingFeatures` (ข้อมูลห้องค่อนข้างสะอาด อาจเจอพร้อมราคาอยู่แล้ว)

## ไฟล์ที่ใช้วิเคราะห์ (temp)

- `ddproperty.html` — หน้า1 ต้นฉบับ
- `p2.html` — หน้า2 (ยืนยัน pagination)
- `nextdata.json` — JSON `__NEXT_DATA__` ที่แยกออกมาแล้ว