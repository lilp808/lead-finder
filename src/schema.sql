-- Run this in Supabase SQL Editor once before first deploy
-- Migration history:
--   Renamed group_url → source_url
--   Added source_platform, screenshot_urls, assigned_to, assigned_at,
--         call_history, appointment_history, roof_gps, roof_screenshot_url

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  post_url        text unique not null,
  source_url      text not null,
  source_platform text not null default 'facebook',
  author_name     text,
  author_url      text,
  posted_at       timestamptz,
  collected_at    timestamptz default now(),

  -- Property info (from Groq extraction)
  property_type   text,
  listing_status  text,
  rent_price      numeric,
  sale_price      numeric,
  land_area       text,
  building_area   text,
  province        text,
  district        text,
  sub_district    text,
  address         text,
  location_est    text,

  -- Contact info
  contact_name    text,
  phone_number    text,
  line_id         text,
  whatsapp        text,
  wechat          text,
  owner_or_agent  text,

  -- Media
  image_urls      text[],
  screenshot_urls text[],

  -- AI enrichment
  raw_post_text   text,
  ai_summary      text,
  ai_tags         text[],
  confidence_score numeric,
  lead_score      integer,

  -- Internal tracking
  lead_status     text default 'new',
  notes           text,
  assigned_to     text,
  assigned_at     timestamptz,
  call_history    jsonb,
  appointment_history jsonb,

  -- Roof hunting
  roof_gps        point,
  roof_screenshot_url text,

  updated_at      timestamptz default now()
);

create index if not exists idx_leads_post_url on leads(post_url);
create index if not exists idx_leads_status on leads(lead_status);

-- Storage bucket: create via Dashboard > Storage > Create Bucket
-- Name: lead-images
-- Public: true

-- Source configs (web-managed, replaces GROUP_URLS env)
create table if not exists source_configs (
  id             uuid primary key default gen_random_uuid(),
  platform       text not null default 'facebook',
  label          text not null,
  source_url     text not null,
  results_limit  int not null default 5,
  active         boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Cron schedules (web-managed, overrides vercel.json cron)
create table if not exists cron_schedules (
  id        uuid primary key default gen_random_uuid(),
  hour      int not null check (hour >= 0 and hour <= 23),
  minute    int not null default 0 check (minute >= 0 and minute <= 59),
  label     text,
  active    boolean default true,
  created_at timestamptz default now()
);

insert into cron_schedules (hour, minute, label, active) values
  (6, 0, 'เช้า 06:00', true);
