-- Stage 2: automated street audit engine.
--
-- The machine measures and drafts; staff only approve. Nothing here writes to
-- street_status or shows anything to the public: an audit becomes public only
-- when staff approve it (stage 3), and only its non-staff_only results.
--
-- Pattern (from moked106-admin): checks -> errors block the draft, warnings
-- need explicit acknowledgment at approval, every run is a new version,
-- nothing is overwritten.

-- ================================================================ tables
create table if not exists public.criteria (
  id               text primary key,
  family           text not null check (family in ('skeleton', 'section', 'frontage', 'texture_climate')),
  name_he          text not null,
  metric           text not null,
  unit             text not null default '',
  method           text not null check (method in ('gis', 'remote_sensing', 'registry', 'resident')),
  vote_key         text check (vote_key in ('shade', 'walking', 'frontages', 'staying', 'mix', 'maintenance', 'safety')),
  automation_level text not null check (automation_level in ('A', 'B', 'C', 'D')),
  measure          text,             -- which measurement feeds it (streets.gis key, sidewalkPct, moked106:<topic>)
  benchmark_key    text,             -- column of the typology table in lib/city.ts
  source           text not null default '',
  placeholder      boolean not null default true,
  sort             int not null default 0
);

create table if not exists public.typology_benchmarks (
  typology     text not null check (typology in ('neighborhood_commercial', 'main_commercial', 'residential', 'boulevard', 'pedestrian_mall', 'linear_park')),
  criterion_id text not null references public.criteria (id) on delete cascade,
  target_min   numeric,
  target_max   numeric,
  placeholder  boolean not null default true,
  primary key (typology, criterion_id)
);

create table if not exists public.street_audits (
  id                    uuid primary key default gen_random_uuid(),
  street_id             uuid not null references public.streets (id),
  version               int not null,
  run_at                timestamptz not null default now(),
  run_by                text not null default 'staff',   -- staff | votes_threshold | weekly
  engine_version        text not null,
  state                 text not null check (state in ('blocked', 'draft', 'approved', 'edited_approved', 'returned_to_field')),
  errors                jsonb not null default '[]',
  warnings              jsonb not null default '[]',
  proposed_status       text check (proposed_status in ('under_review', 'in_progress', 'done')),
  proposed_note_he      text,
  note_source           text,                            -- template | claude
  final_status          text check (final_status in ('under_review', 'in_progress', 'done')),
  final_note_he         text,
  reviewed_by           uuid references public.staff (user_id),
  reviewed_at           timestamptz,
  return_reason         text,
  acknowledged_warnings boolean not null default false,
  unique (street_id, version)
);
create index if not exists street_audits_street_idx on public.street_audits (street_id, version desc);

create table if not exists public.audit_results (
  audit_id          uuid not null references public.street_audits (id) on delete cascade,
  criterion_id      text not null references public.criteria (id),
  value             numeric,
  benchmark_min     numeric,
  benchmark_max     numeric,
  verdict           text not null check (verdict in ('meets', 'partial', 'below', 'no_data')),
  confidence        text not null check (confidence in ('high', 'medium', 'low')),
  data_source       text,
  data_date         date,
  resident_avg      numeric,
  resident_n        int not null default 0,
  gap_class         text not null check (gap_class in ('aligned', 'residents_higher', 'residents_lower', 'insufficient')),
  needs_field_check boolean not null default false,
  staff_only        boolean not null default false,
  primary key (audit_id, criterion_id)
);

-- Street x topic counts from the moked106 bucket (internal month files, active
-- version). Filled by the audit-refresh edge function. Staff only, always.
create table if not exists public.moked106_street_counts (
  street_id      uuid not null references public.streets (id),
  topic          text not null check (topic in ('maintenance', 'safety')),
  month          text not null check (month ~ '^\d{4}-\d{2}$'),
  count          int not null,
  source_version text not null,
  loaded_at      timestamptz not null default now(),
  primary key (street_id, topic, month)
);

-- ================================================================ RLS
alter table public.criteria enable row level security;
alter table public.typology_benchmarks enable row level security;
alter table public.street_audits enable row level security;
alter table public.audit_results enable row level security;
alter table public.moked106_street_counts enable row level security;

drop policy if exists criteria_read on public.criteria;
create policy criteria_read on public.criteria for select using (true);
drop policy if exists benchmarks_read on public.typology_benchmarks;
create policy benchmarks_read on public.typology_benchmarks for select using (true);

-- Audits: staff see everything; the public sees approved audits only.
drop policy if exists audits_read on public.street_audits;
create policy audits_read on public.street_audits for select
  using (state in ('approved', 'edited_approved') or public.is_staff());

-- Results: the public sees non-staff_only rows of approved audits only.
drop policy if exists audit_results_read on public.audit_results;
create policy audit_results_read on public.audit_results for select
  using (
    public.is_staff()
    or (
      staff_only = false
      and exists (select 1 from public.street_audits a
                  where a.id = audit_id and a.state in ('approved', 'edited_approved'))
    )
  );

drop policy if exists moked106_counts_staff on public.moked106_street_counts;
create policy moked106_counts_staff on public.moked106_street_counts for select to authenticated
  using (public.is_staff());

-- No insert/update/delete policies: audits are written only by the definer
-- functions below, and approved only by the stage 3 approval function.
revoke insert, update, delete on public.street_audits, public.audit_results,
  public.moked106_street_counts, public.criteria, public.typology_benchmarks from anon, authenticated;
revoke all on public.moked106_street_counts from anon;

-- ================================================================ level A measures
-- Each returns null when the data is missing. Missing is never a low score.

-- Average distance between intersections along the street: length divided by
-- the number of stretches between points where another street meets it.
create or replace function public.audit_intersection_distance(p_street_id uuid)
returns numeric language sql stable set search_path = public as $$
  with s as (select geom from streets where id = p_street_id and geom is not null),
  hits as (
    select count(distinct st_snaptogrid(st_intersection(s.geom, o.geom), 1)) n
    from s join streets o on o.id <> p_street_id and o.geom is not null and st_intersects(s.geom, o.geom)
  )
  select case when h.n >= 2 then round((st_length(s.geom) / (h.n - 1))::numeric, 1) end
  from s, hits h;
$$;

-- Block length: the longest stretch between consecutive intersections.
create or replace function public.audit_block_length(p_street_id uuid)
returns numeric language sql stable set search_path = public as $$
  with s as (select geom from streets where id = p_street_id and geom is not null),
  pts as (
    select st_linelocatepoint(st_linemerge(s.geom), (st_dump(st_intersection(s.geom, o.geom))).geom) f
    from s join streets o on o.id <> p_street_id and o.geom is not null and st_intersects(s.geom, o.geom)
    where geometrytype(st_linemerge(s.geom)) = 'LINESTRING'
  ),
  ordered as (select f, lead(f) over (order by f) nf from pts)
  select round((max(nf - f) * (select st_length(geom) from s))::numeric, 1) from ordered where nf is not null;
$$;

-- ROW width, sidewalk width/share and H/W need municipal parcel, sidewalk and
-- building layers that are not loaded yet. Until then they read the manual
-- values in streets.gis (source "manual").
create or replace function public.audit_gis_value(p_street_id uuid, p_key text)
returns numeric language sql stable set search_path = public as $$
  select nullif(gis ->> p_key, '')::numeric from streets where id = p_street_id;
$$;

-- ================================================================ engine
create or replace function public.run_street_audit(p_street_id uuid, p_run_by text default 'staff')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  engine   constant text := '0.1-placeholder';
  s        record;
  c        record;
  v_audit  uuid;
  v_ver    int;
  errs     jsonb := '[]';
  warns    jsonb := '[]';
  val      numeric;
  bmin     numeric;
  bmax     numeric;
  verdict  text;
  conf     text;
  src      text;
  ddate    date;
  r_avg    numeric;
  r_n      int;
  gap      text;
  m_score  numeric;
  staffonly boolean;
  real_votes int;
  n_below  int := 0;
  n_meets  int := 0;
  n_partial int := 0;
  n_measured int := 0;
  note     text;
begin
  -- Staff through the API, or the owner/service role for scheduled runs.
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_staff() then
    raise exception 'STAFF_ONLY';
  end if;

  select * into s from streets where id = p_street_id;
  if not found then raise exception 'STREET_NOT_FOUND'; end if;

  select count(*) into real_votes from votes where street_id = p_street_id and is_demo = false;

  if s.geom is null then
    errs := errs || jsonb_build_object('code', 'no_geom', 'text', 'לרחוב אין גיאומטריה (קו אמצע מ-GIS עירוני) — אי אפשר למדוד בפועל.');
  end if;
  if s.typology is null then
    errs := errs || jsonb_build_object('code', 'no_typology', 'text', 'לא נקבע סוג רחוב — אין מול מה להשוות.');
  end if;

  select coalesce(max(version), 0) + 1 into v_ver from street_audits where street_id = p_street_id;
  insert into street_audits (street_id, version, run_by, engine_version, state)
  values (p_street_id, v_ver, p_run_by, engine, 'draft')
  returning id into v_audit;

  for c in select * from criteria order by sort loop
    val := null; bmin := null; bmax := null; src := null; ddate := null;
    conf := 'low'; staffonly := false;

    -- ------------------------------------------------ the measurement
    if c.measure = 'intersectionDistanceM' then
      val := audit_intersection_distance(p_street_id);
      if val is not null then
        src := 'קווי אמצע רחובות (PostGIS)'; conf := 'high';
      else
        val := audit_gis_value(p_street_id, 'intersectionDistanceM');
        if val is not null then src := 'הזנה ידנית (streets.gis)'; conf := 'medium'; end if;
      end if;
    elsif c.measure like 'moked106:%' then
      staffonly := true;
      select sum(count), max(month) into val, src from moked106_street_counts
      where street_id = p_street_id and topic = split_part(c.measure, ':', 2)
        and month >= to_char(now() - interval '12 months', 'YYYY-MM');
      if val is not null then
        ddate := to_date(src || '-01', 'YYYY-MM-DD');
        src := 'מוקד 106, קבצים חודשיים (גרסה פעילה)'; conf := 'medium';
      else
        src := null;
      end if;
    elsif c.measure is not null then
      val := audit_gis_value(p_street_id, c.measure);
      if val is not null then
        src := 'הזנה ידנית (streets.gis)'; conf := 'medium';
        ddate := nullif(s.gis ->> 'date', '')::date;
      end if;
    end if;

    -- ------------------------------------------------ the target
    if s.typology is not null then
      select target_min, target_max into bmin, bmax
      from typology_benchmarks where typology = s.typology and criterion_id = c.id;
    end if;

    -- ------------------------------------------------ the verdict
    if val is null then
      verdict := 'no_data';
    elsif bmin is null and bmax is null then
      verdict := 'no_data';
      if c.method in ('gis', 'remote_sensing') and s.typology is not null then
        errs := errs || jsonb_build_object('code', 'no_benchmark', 'criterion', c.id,
          'text', 'אין ערך יעד ל"' || c.name_he || '" בסוג הרחוב הזה, אז אי אפשר לשפוט את המדידה.');
      end if;
    elsif (bmin is null or val >= bmin) and (bmax is null or val <= bmax) then
      verdict := 'meets';
    elsif (bmin is null or val >= bmin * 0.85) and (bmax is null or val <= bmax * 1.15) then
      verdict := 'partial';
    else
      verdict := 'below';
    end if;

    -- ------------------------------------------------ residents
    r_avg := null; r_n := 0;
    if c.vote_key is not null then
      select round(avg((scores ->> c.vote_key)::numeric), 2), count(scores ->> c.vote_key)
      into r_avg, r_n
      from votes where street_id = p_street_id and is_demo = false and scores ? c.vote_key;
    end if;

    if verdict = 'no_data' or r_n < 10 or r_avg is null then
      gap := 'insufficient';
    else
      m_score := case verdict when 'meets' then 1 when 'partial' then 0.5 else 0 end;
      gap := case
        when (r_avg - 1) / 4 - m_score > 0.35 then 'residents_higher'
        when (r_avg - 1) / 4 - m_score < -0.35 then 'residents_lower'
        else 'aligned' end;
    end if;

    -- ------------------------------------------------ warnings
    if verdict <> 'no_data' and ddate is null and not staffonly then
      warns := warns || jsonb_build_object('code', 'unknown_date', 'criterion', c.id,
        'text', '"' || c.name_he || '": תאריך הנתון אינו ידוע (הזנה ידנית).');
    elsif ddate is not null and ddate < (now() - interval '3 years')::date then
      warns := warns || jsonb_build_object('code', 'old_data', 'criterion', c.id,
        'text', '"' || c.name_he || '": הנתון ישן מ-3 שנים (' || to_char(ddate, 'MM/YYYY') || ').');
    end if;
    if gap in ('residents_higher', 'residents_lower') then
      warns := warns || jsonb_build_object('code', 'large_gap', 'criterion', c.id,
        'text', '"' || c.name_he || '": פער גדול בין המדידה לדירוג התושבים (' || r_avg || ' מתוך 5, ' || r_n || ' מדרגים).');
    end if;
    if verdict <> 'no_data' and conf = 'low' then
      warns := warns || jsonb_build_object('code', 'low_confidence', 'criterion', c.id,
        'text', '"' || c.name_he || '": רמת ביטחון נמוכה במדידה.');
    end if;

    insert into audit_results (audit_id, criterion_id, value, benchmark_min, benchmark_max, verdict,
      confidence, data_source, data_date, resident_avg, resident_n, gap_class, needs_field_check, staff_only)
    values (v_audit, c.id, val, bmin, bmax, verdict, conf, src, ddate, r_avg, r_n, gap,
      gap in ('residents_higher', 'residents_lower') or verdict = 'below', staffonly);

    if not staffonly and verdict <> 'no_data' then
      n_measured := n_measured + 1;
      if verdict = 'meets' then n_meets := n_meets + 1;
      elsif verdict = 'partial' then n_partial := n_partial + 1;
      else n_below := n_below + 1; end if;
    end if;
  end loop;

  if real_votes < 10 then
    warns := warns || jsonb_build_object('code', 'few_votes',
      'text', 'רק ' || real_votes || ' דירוגים אמיתיים (לא הדגמה). מתחת ל-10 אין השוואה לתושבים.');
  end if;

  -- Template note. Cites only non-staff_only numbers; the Claude draft (when
  -- configured) replaces it through /api/admin/audit.
  if jsonb_array_length(errs) = 0 then
    note := 'נבדקו ' || n_measured || ' מדדים ב' || s.name || ' מול היעד לסוג הרחוב: '
      || n_meets || ' עומדים ביעד, ' || n_partial || ' חלקית ו-' || n_below || ' מתחת ליעד.';
    if real_votes >= 10 then
      note := note || ' ' || real_votes || ' תושבים דירגו את הרחוב.';
    end if;
  end if;

  update street_audits set
    state = case when jsonb_array_length(errs) > 0 then 'blocked' else 'draft' end,
    errors = errs,
    warnings = warns,
    proposed_status = case when jsonb_array_length(errs) > 0 then null
                           when n_below > 0 then 'in_progress' else 'under_review' end,
    proposed_note_he = note,
    note_source = case when note is null then null else 'template' end
  where id = v_audit;

  return v_audit;
end;
$$;

create or replace function public.run_all_street_audits(p_run_by text default 'staff')
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.is_staff() then
    raise exception 'STAFF_ONLY';
  end if;
  for r in select id from streets order by name loop
    perform public.run_street_audit(r.id, p_run_by);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.run_street_audit(uuid, text) from public, anon;
revoke all on function public.run_all_street_audits(text) from public, anon;
grant execute on function public.run_street_audit(uuid, text) to authenticated;
grant execute on function public.run_all_street_audits(text) to authenticated;

-- Latest run per street, for the staff screens.
create or replace view public.street_audit_latest
with (security_invoker = true) as
  select distinct on (a.street_id) a.*
  from public.street_audits a
  order by a.street_id, a.version desc;
grant select on public.street_audit_latest to authenticated;
