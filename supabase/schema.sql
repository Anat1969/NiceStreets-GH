-- Good Streets Ashdod — Supabase schema, RLS and storage policies.
-- Apply with: supabase db push, or paste into the SQL editor.
--
-- Model: the browser never talks to Supabase directly. Next.js route handlers
-- authorise every request and use the service-role key. RLS below is the
-- second line of defence and also covers any future direct-from-client access.

create extension if not exists postgis;
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- reference

create table if not exists quarters (
  id          text primary key,
  name        text not null,
  polygon     jsonb,                      -- [[lon,lat], ...] ring, for the UI
  center      jsonb,                      -- [lon,lat]
  geom        geometry(Polygon, 4326),    -- authoritative municipal boundary
  schematic   boolean not null default true
);

create table if not exists streets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  quarter_id  text not null references quarters(id),
  typology    text not null check (typology in (
                'neighborhood_commercial','main_commercial','residential',
                'boulevard','pedestrian_mall','linear_park')),
  line        jsonb,                          -- [[lon,lat], ...] for the UI
  geom        geometry(LineString, 4326),     -- municipal centreline
  gis         jsonb,                          -- row_width_m, w_h, canopy_pct, ...
  verified    boolean not null default false, -- matched against the GIS layer
  created_at  timestamptz not null default now(),
  unique (name, quarter_id)
);

create index if not exists streets_quarter_idx on streets (quarter_id);
create index if not exists streets_geom_idx on streets using gist (geom);
create index if not exists quarters_geom_idx on quarters using gist (geom);

-- --------------------------------------------------------------- resident data

create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  street_id   uuid not null references streets(id) on delete cascade,
  quarter_id  text not null references quarters(id),
  typology    text not null,
  scores      jsonb not null,   -- {shade:1..5, walking:.., ..., safety:..}
  reason      text default '',
  photo_id    uuid,
  user_id     text not null,    -- anonymous id; no personal details are stored
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_demo     boolean not null default false,
  -- one vote per user per street; a repeat vote updates the previous one
  unique (user_id, street_id)
);

create index if not exists votes_street_idx on votes (street_id);

create table if not exists photos (
  id            uuid primary key default gen_random_uuid(),
  vote_id       uuid references votes(id) on delete cascade,
  street_id     uuid not null references streets(id) on delete cascade,
  storage_path  text not null,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  is_demo       boolean not null default false
);

create index if not exists photos_street_idx on photos (street_id, status);

alter table votes
  add constraint votes_photo_fk
  foreign key (photo_id) references photos(id) on delete set null
  not valid;

create table if not exists street_status (
  street_id    uuid primary key references streets(id) on delete cascade,
  status       text not null check (status in (
                 'received','under_review','planned','in_progress','done')),
  public_note  text default '',
  updated_by   text default '',
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------ staff role

-- A user is staff when their auth uid appears here. Populate it manually for
-- the City Architect's team; nobody can add themselves (see the policy below).
create table if not exists staff (
  user_id   uuid primary key,
  name      text,
  added_at  timestamptz not null default now()
);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

-- --------------------------------------------------------------------- RLS

alter table quarters      enable row level security;
alter table streets       enable row level security;
alter table votes         enable row level security;
alter table photos        enable row level security;
alter table street_status enable row level security;
alter table staff         enable row level security;

-- Reference data is public.
drop policy if exists quarters_read on quarters;
create policy quarters_read on quarters for select using (true);

drop policy if exists streets_read on streets;
create policy streets_read on streets for select using (true);

-- Any signed-in resident (including anonymous sign-in) may add a street.
drop policy if exists streets_insert on streets;
create policy streets_insert on streets for insert
  with check (auth.uid() is not null and verified = false);

drop policy if exists streets_staff_write on streets;
create policy streets_staff_write on streets for update using (is_staff());

-- Votes: everyone reads (the app only ever shows aggregates and free text),
-- residents write only their own row.
drop policy if exists votes_read on votes;
create policy votes_read on votes for select using (true);

drop policy if exists votes_insert_own on votes;
create policy votes_insert_own on votes for insert
  with check (user_id = auth.uid()::text and is_demo = false);

drop policy if exists votes_update_own on votes;
create policy votes_update_own on votes for update
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists votes_staff_delete on votes;
create policy votes_staff_delete on votes for delete using (is_staff());

-- Photos: the public sees approved photos only; staff see and moderate all.
drop policy if exists photos_read_approved on photos;
create policy photos_read_approved on photos for select
  using (status = 'approved' or is_staff());

drop policy if exists photos_insert on photos;
create policy photos_insert on photos for insert
  with check (auth.uid() is not null and status = 'pending');

drop policy if exists photos_staff_write on photos;
create policy photos_staff_write on photos for update using (is_staff());

drop policy if exists photos_staff_delete on photos;
create policy photos_staff_delete on photos for delete using (is_staff());

-- Municipal status: public reads, staff alone writes.
drop policy if exists status_read on street_status;
create policy status_read on street_status for select using (true);

drop policy if exists status_staff_write on street_status;
create policy status_staff_write on street_status for all
  using (is_staff()) with check (is_staff());

-- The staff table is readable by staff and writable by nobody through the API;
-- add members with the service-role key or from the Supabase dashboard.
drop policy if exists staff_read on staff;
create policy staff_read on staff for select using (is_staff());

-- ------------------------------------------------------------------ storage

insert into storage.buckets (id, name, public)
values ('street-photos', 'street-photos', false)
on conflict (id) do nothing;

drop policy if exists photos_upload on storage.objects;
create policy photos_upload on storage.objects for insert
  with check (bucket_id = 'street-photos' and auth.uid() is not null);

drop policy if exists photos_staff_read on storage.objects;
create policy photos_staff_read on storage.objects for select
  using (bucket_id = 'street-photos' and is_staff());
