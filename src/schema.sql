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
  source_config_id uuid,
  source_name     text,
  author_name     text,
  author_url      text,
  posted_at       timestamptz,
  collected_at    timestamptz default now(),

  -- Property info (from Groq extraction)
  property_type   text,
  listing_status  text,
  rent_price      numeric,
  sale_price      numeric,
  rent_price_raw  numeric,
  sale_price_raw  numeric,
  rent_price_unit text,
  sale_price_unit text,
  pricing_area_sqm numeric,
  land_area       text,
  land_area_sqm   numeric,
  building_area   text,
  building_area_sqm numeric,
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
  agent_team      text,

  -- Roof hunting
  roof_gps        point,
  roof_screenshot_url text,

  updated_at      timestamptz default now()
);

create index if not exists idx_leads_post_url on leads(post_url);
create index if not exists idx_leads_status on leads(lead_status);

-- Migration for existing DBs (pricing audit fields)
alter table leads add column if not exists rent_price_raw numeric;
alter table leads add column if not exists sale_price_raw numeric;
alter table leads add column if not exists rent_price_unit text;
alter table leads add column if not exists sale_price_unit text;
alter table leads add column if not exists pricing_area_sqm numeric;
alter table leads add column if not exists land_area_sqm numeric;
alter table leads add column if not exists building_area_sqm numeric;
alter table leads add column if not exists bedrooms numeric;
alter table leads add column if not exists bathrooms numeric;
alter table leads add column if not exists tenure text;

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
  model_provider text not null default 'typhoon',
  model_name     text not null default 'typhoon-v2.5-30b-a3b-instruct',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Migration for existing DBs (columns added after table creation)
alter table source_configs add column if not exists model_provider text not null default 'typhoon';
alter table source_configs add column if not exists model_name text not null default 'typhoon-v2.5-30b-a3b-instruct';

-- Cron schedules (web-managed, overrides vercel.json cron)
create table if not exists cron_schedules (
  id        uuid primary key default gen_random_uuid(),
  hour      int not null check (hour >= 0 and hour <= 23),
  minute    int not null default 0 check (minute >= 0 and minute <= 59),
  label     text,
  active    boolean default true,
  endpoint  text default '/api/collect',
  created_at timestamptz default now()
);

insert into cron_schedules (hour, minute, label, active) values
  (6, 0, 'เช้า 06:00', true);

-- Migration for existing DBs
alter table cron_schedules add column if not exists endpoint text default '/api/collect';

-- Migration for existing DBs (source attribution)
alter table leads add column if not exists source_config_id uuid;
alter table leads add column if not exists source_name text;

-- Migration for existing DBs (agent team A/B/C)
alter table leads add column if not exists agent_team text;

-- DDProperty source (warehouse/factory for rent) — test quota 10/day
insert into source_configs (platform, label, source_url, results_limit, active)
values (
  'ddproperty',
  'DDProperty Warehouse/Rent (test 10)',
  'https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true',
  10,
  true
);
