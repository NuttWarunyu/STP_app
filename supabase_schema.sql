-- Run this in Supabase SQL editor

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'เจ้าหน้าที่',
  rank_level integer not null default 1,
  total_detections integer not null default 0,
  unique_provinces text[] not null default '{}',
  unique_classes text[] not null default '{}',
  daily_scans_count integer not null default 0,
  last_scan_date date,
  sequence serial,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  ghost_class text not null,
  ghost_name_th text,
  location_name text,
  province text,
  lat double precision,
  lng double precision,
  photo_url text,
  report_number text,
  danger_level integer default 3,
  claude_reason text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table reports enable row level security;

-- Profiles: users can read all, update own
create policy "public read profiles" on profiles for select using (true);
create policy "users update own profile" on profiles for update using (auth.uid() = id);
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Reports: public read, authenticated insert own
create policy "public read reports" on reports for select using (true);
create policy "users insert own reports" on reports for insert with check (auth.uid() = user_id);
