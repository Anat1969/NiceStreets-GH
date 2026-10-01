-- Stage 0, part A: identity foundations. Additive only.
--
-- Nothing here removes access, so the build that is live when this runs keeps
-- working. Part B (stage0b) removes the anon ALL policies, and runs only after
-- the build that signs people in is live.
--
-- The model:
--   resident = any signed-in user (Supabase anonymous sign-in), identified by auth.uid().
--   staff    = a row in public.staff, linked by e-mail from public.staff_invites
--              the first time that address confirms a magic link.
--   admin    = staff with role 'admin' (the city architect).

-- ------------------------------------------------------------- staff
alter table public.staff add column if not exists email text;
alter table public.staff add column if not exists role text not null default 'staff';
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('staff', 'admin'));

create table if not exists public.staff_invites (
  email      text primary key,
  role       text not null default 'staff' check (role in ('staff', 'admin')),
  name       text,
  created_at timestamptz not null default now()
);
-- No policies: the table is reachable only through the definer trigger below.
alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;

insert into public.staff_invites (email, role, name)
values ('shtanat5@gmail.com', 'admin', 'ענת')
on conflict (email) do nothing;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;

-- Links a confirmed, non-anonymous user to an invite with the same address.
create or replace function public.link_staff_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null
     and new.email_confirmed_at is not null
     and coalesce(new.is_anonymous, false) = false then
    insert into public.staff (user_id, name, role, email)
    select new.id, i.name, i.role, i.email
    from public.staff_invites i
    where lower(i.email) = lower(new.email)
    on conflict (user_id) do update
      set role = excluded.role, email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists nicestreets_link_staff on auth.users;
create trigger nicestreets_link_staff
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.link_staff_invite();

-- ------------------------------------------------------------- photos
-- Who uploaded a photo, so a resident can attach bytes to their own pending
-- photo and nothing else.
alter table public.photos add column if not exists created_by uuid default auth.uid();

-- ------------------------------------------------------------- public reads
-- Votes without the voter. The public screens need scores and reasons; they
-- never need to know which anonymous id wrote which vote.
create or replace view public.votes_public
with (security_invoker = false) as
  select id, street_id, quarter_id, typology, typology_suggestion, scores,
         reason, photo_id, created_at, updated_at, is_demo
  from public.votes;
comment on view public.votes_public is
  'Owner-rights view by design: exposes votes to the public without user_id.';
grant select on public.votes_public to anon, authenticated;

-- The bytes of a photo, only when the photo is public. Pending, rejected,
-- test and demo photos never come out of here.
create or replace function public.public_photo_blob(p_photo_id uuid)
returns table (content_type text, data_base64 text)
language sql stable security definer set search_path = public as $$
  select b.content_type, b.data_base64
  from public.photo_blobs b
  join public.photos p on p.id = b.photo_id
  where b.photo_id = p_photo_id
    and p.status = 'approved'
    and p.source in ('resident', 'example')
    and p.is_demo = false;
$$;
grant execute on function public.public_photo_blob(uuid) to anon, authenticated;

-- ------------------------------------------------------------- streets
-- A street row is created the first time someone rates it. The app validates
-- the code and name against the national registry before calling this; the
-- function accepts only a signed-in caller and a well-formed code, and never
-- overwrites an existing row.
create or replace function public.ensure_street(
  p_code text, p_name text, p_quarter_id text default null,
  p_typology text default null, p_line jsonb default null, p_gis jsonb default null
) returns public.streets
language plpgsql security definer set search_path = public as $$
declare
  row public.streets;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_code !~ '^[0-9]{1,6}(#q-[a-z0-9-]{1,24})?$' or length(coalesce(p_name, '')) not between 1 and 80 then
    raise exception 'STREET_INVALID';
  end if;
  select * into row from public.streets where code = p_code limit 1;
  if found then
    return row;
  end if;
  insert into public.streets (code, name, quarter_id, typology, line, gis, verified)
  values (
    p_code, p_name,
    (select id from public.quarters where id = p_quarter_id),
    p_typology, p_line,
    case when p_gis is null then null else p_gis || jsonb_build_object('source', 'manual') end,
    true
  )
  returning * into row;
  return row;
end;
$$;
revoke all on function public.ensure_street(text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.ensure_street(text, text, text, text, jsonb, jsonb) to authenticated;
