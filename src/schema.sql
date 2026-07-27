-- Run this in Supabase SQL Editor once before first deploy

create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  post_url        text unique not null,
  group_url       text not null,
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

  -- AI enrichment
  raw_post_text   text,
  ai_summary      text,
  ai_tags         text[],
  confidence_score numeric,
  lead_score      integer,

  -- Internal tracking
  lead_status     text default 'new',
  notes           text,

  updated_at      timestamptz default now()
);

create index if not exists idx_leads_post_url on leads(post_url);
create index if not exists idx_leads_status on leads(lead_status);

-- Storage bucket: create via Dashboard > Storage > Create Bucket
-- Name: lead-images
-- Public: true
