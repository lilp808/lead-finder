# Property Lead Intelligence Platform

## Commands

| Command | What |
|---|---|
| `npm run scrape` | Trigger Apify facebook-groups-scraper runs for all active sources in DB |
| `npm run backfill:result` | Run result-leads workflow on existing leads (populates `result_leads`) |
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
/api/cron-check (cron 06:00 UTC daily)
  └─ Check cron_schedules WHERE active=true
       └─ If time matches → fetch /api/collect internally
```

Note: Hobby plan = 1 cron/day at fixed time. Scheduler UI stores multiple schedules for future Pro upgrade.

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
- **Dedup (Facebook)**: two-stage in `src/collectors/facebook.js processOneItem` — (1) same `post_url` → duplicate; (2) global content match: same `raw_post_text` (exact) AND same image count → `duplicate reason='repost'` (skipped, no AI call). Index `idx_leads_post_content` on `raw_post_text`.
- **Google Maps URL**: `extractGoogleMapsUrl(text)` in `facebook.js` regex-extracts a Google Maps URL (maps.google.* / goo.gl/maps / maps.app.goo.gl / www.google.*/maps) from the caption without AI → `google_maps_url` column. Shown in lead detail + CSV export.
- **Collect log**: `/api/collect` persists one `lead_logs` row per run via `src/lib/log.js` `saveRunLog` (name = datetime `label`). Only `/api/collect` persists — webhook/dd-collect/CLI do NOT. View history at `/logs` (`api/logs/index.js`, `scripts/logs.html`).
- **Log message**: `item` steps carry `property_type/area/province/district/postUrl/reason`. Inserted → "Saved — type · area · province"; skipped shows reason (`existing_url`/`repost`/`low_confidence`/`error`) + post URL.
- **Groq prompt** (`src/lib/prompts/extract-property.md`): Thai property extraction. Loaded in `src/lib/groq.js`. Returns JSON. Posts with `confidence_score < 0.3` are dropped.
- **Image timeout**: 15s per image, max 10 images per post.
- **Env required**: `APIFY_API_KEY`, `APIFY_ACTOR_ID` (default `apify/facebook-groups-scraper`), `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_WEBHOOK_URL`. **AI**: `TYPHOON_API_KEY` (default) or `GROQ_API_KEY` (optional alternate).
- **DDProperty is local-only**: DDProperty sits behind Cloudflare that serves a JS challenge to **datacenter IPs** (Vercel/AWS), so all direct fetch/JSON/api paths fail on the server (even curl). It works only from a residential IP. Gate via `DD_ENABLED=1`:
  - `.env.local` sets `DD_ENABLED=1` → local Collect + `npm run scrape` collect DD via `curl`.
  - Vercel does NOT set it → `/api/collect` and `/api/dd-collect` skip DD and emit `dd_skipped` step.
  - Run DD manually on local: `node --env-file=.env.local scripts/dd-collect.mjs [quota]`.
  - Keep only the `curl`-based path in `src/lib/ddproperty.js` (`ddproperty` fetch). Do NOT call it with node `fetch`/`axios` from the server.
- **Facebook auth**: Cookie/session must be configured inside Apify Console actor input — not in env.
- **No test/lint/typecheck framework** exists.
- **Vercel**: Function maxDuration 60s. Cron `/api/cron-check` daily at 6 AM UTC (`vercel.json`).
- **ESM** throughout (`"type": "module"` in package.json).

## Constraint

Platform is property-lead-intelligence, not a Facebook scraper. Facebook is source #1; new sources must be pluggable without pipeline rewrites.

## Result Leads workflow (`src/workflow/result-leads.js`)

After a lead is inserted, `processLeadForResult(supabase, lead, steps)` runs automatically (hooked in `facebook.js processOneItem` + `api/dd-collect.js processOneListing`; webhook path reuses `processItems` → covered).

- **Completeness** (`isComplete`): must have SQM (any of `pricing_area_sqm`/`land_area_sqm`/`building_area_sqm`), `province`+`district`+`sub_district`, ≥1 `image_urls`, price (`rent_price`/`sale_price`), and `agent_team`. Incomplete leads stay in `leads` only; missing fields pushed as `workflow_check` step.
- **Snapshot** (`toSnapshot`): complete leads are copied into `result_leads` (`lead_id` unique, upsert on conflict) with normalized location columns `province_norm/district_norm/sub_district_norm` (from `src/lib/agent-team.js`).
- **Dedup** (`findDuplicates`): candidate = same normalized location AND any sqm column exactly equal (column-to-column).
- **Vision verify** (`src/lib/vision.js`, prompt `compare-properties.md`): Groq `qwen/qwen3.6-27b` (JSON mode), ≤2 images/side. `same_place && confidence ≥ 0.7` → merge.
- **Merge**: keep the more complete lead (field+image count; tie → the one recorded first). Delete loser from `result_leads`, set `leads.lead_status='merged'` + `merged_into_lead_id` (leads row is NOT deleted — keeps source URL to prevent re-scrape). Vision unavailable/error → no merge, logged as `workflow_dedup unverified` and the new lead is still snapshotted for review.
- **Backfill existing rows**: `node --env-file=.env.local scripts/backfill-result-leads.mjs`.
- **UI**: `/result` page (`scripts/result.html`) reads `api/result-leads`. Route registered in `scripts/dev.mjs`.
- Requires `GROQ_API_KEY` for the vision step.

## Collector interface (`src/collectors/`)

Each platform lives in one module with a uniform interface, registered in `src/collectors/index.js` (`collectors` map). Adding a platform = add one file + one registry line; `/api/collect` dispatches generically.

- `platform` (string), `label` (string)
- `isAvailable()` → boolean (env checks; e.g. facebook→`APIFY_API_KEY`, ddproperty→`DD_ENABLED==='1'`)
- `disabledHint` (string) — shown in the `platform_skipped` log step when unavailable
- `collect({ supabase, sources, steps, opts })` → `{ results, skipped }`
  - Pushes its own log steps (`source_start`, `fetch`, `item`, `fetched`, `source_error`, …) into `steps`.
  - Do NOT push a `summary` step — the dispatcher adds one combined summary.
  - `results[]` items use `status: 'inserted' | 'duplicate' | 'error' | 'low_confidence'`.
- Async path note: `api/webhook.js` reuses `facebook.processItems` (steps omitted). `api/collect.js` is the sync path.
- Transport choice (e.g. future VPS proxy for DD) lives inside the collector / its lib — the dispatcher stays generic.

## Agent Team (A/B/C)

Leads get `agent_team` ('A'|'B'|'C'|null) via **deterministic rules** in `src/lib/agent-team.js` — never AI-classified, so no wrong assignment. Compute from `province`/`district` at insert time (facebook + ddproperty) and recompute in `api/leads/[id].js` when location is edited (unless `agent_team` is overridden manually).

- **A**: Samut Prakan, Chachoengsao, Samut Sakhon + Bangkok (Bang Khun Thian, Bang Na, Lat Krabang, Lam Phak Chi, Phra Khanong, Prawet, Saphan Sung, Suan Luang)
- **B**: Chonburi, Rayong
- **C**: Ayutthaya, Pathum Thani, Nonthaburi, Nakhon Pathom + Bangkok (Bang Kapi, Bang Khen, Bueng Kum, Chatuchak, Don Mueang, Khan Na Yao, Khlong Sam Wa, Lak Si, Lat Phrao, Min Buri, Sai Mai, Wang Thonglang)
- Lookup is English-first (DD) with Thai aliases (Facebook). Bangkok → match district list first; unknown Bangkok district or unknown province → `null` (needs review), never guessed.
- Backfill existing rows: `node --env-file=.env.local scripts/backfill-agent-team.mjs`
