-- צפיפות צמתים, מדידה אמיתית (ענת, 09.11.2026, סעיף 13).
--
-- audit_intersection_distance חישבה אורך במעלות ולא במטרים (geom ב-4326 ו-st_length
-- בלי geography), ועיגלה את נקודות החיתוך לרשת של מעלה שלמה — כלומר כל החיתוכים
-- נפלו לנקודה אחת. היא גם חיפשה חיתוכים רק מול הרחובות שבטבלת streets (15),
-- ולא מול כל רשת הרחובות של העיר.
--
-- כאן: 1) כל קטעי שכבת הרחובות העירונית נשמרים בטבלה gis_segments, ומתרעננים
--         בכל לחיצה על "בדיקה אוטומטית לפי מקורות מידע".
--      2) המרחק בין צמתים = אורך הרחוב במטרים, חלקי מספר הקטעים שבין הצמתים.
--         צומת = נקודת חיתוך עם קטע של רחוב אחר (לא חניה), מעוגלת ל-~5 מ'.

create table if not exists public.gis_segments (
  id bigserial primary key,
  code text,
  name text,
  hierarchy numeric,
  type numeric,
  geom geometry(Geometry, 4326) not null
);
create index if not exists gis_segments_geom_idx on public.gis_segments using gist (geom);
create index if not exists gis_segments_code_idx on public.gis_segments (code);
alter table public.gis_segments enable row level security;
drop policy if exists gis_segments_read on public.gis_segments;
create policy gis_segments_read on public.gis_segments for select using (true);

create or replace function public.load_gis_segments(doc jsonb)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare n int;
begin
  delete from public.gis_segments;
  insert into public.gis_segments (code, name, hierarchy, type, geom)
  select nullif(e->'properties'->>'code', ''),
         e->'properties'->>'name',
         (e->'properties'->>'hierarchy')::numeric,
         (e->'properties'->>'type')::numeric,
         ST_SetSRID(ST_GeomFromGeoJSON((e->'geometry')::text), 4326)
  from jsonb_array_elements(doc->'features') e
  where e->'geometry' is not null
    and coalesce((e->'properties'->>'hierarchy')::numeric, 0) <> 9;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.load_gis_segments(jsonb) from public, anon, authenticated;

-- load_gis_streets טוענת גם את כל הקטעים (החלפת טקסט מדויקת, כמו ב-20261105160000).
do $mig$
declare
  def text := pg_get_functiondef('public.load_gis_streets()'::regprocedure);
  anchor constant text := 'get diagnostics n_geom = row_count;';
begin
  if position(anchor in def) = 0 then
    raise exception 'load_gis_streets: anchor not found';
  end if;
  if position('load_gis_segments' in def) = 0 then
    execute replace(def, anchor, anchor || E'\n  perform public.load_gis_segments(doc);');
  end if;
end
$mig$;

create or replace function public.audit_intersection_distance(p_street_id uuid)
returns numeric
language sql
stable
set search_path = public, extensions
as $$
  with s as (
    select geom, code from streets where id = p_street_id and geom is not null
  ), pts as (
    select distinct ST_SnapToGrid((ST_Dump(ST_Intersection(s.geom, g.geom))).geom, 0.00005) p
    from s join gis_segments g
      on ST_Intersects(s.geom, g.geom)
     and coalesce(g.code, '') <> coalesce(s.code, '#')
  ), n as (
    select count(*) k from pts where GeometryType(p) = 'POINT'
  )
  select case when n.k >= 2 then round((ST_Length(s.geom::geography) / (n.k - 1))::numeric, 1) end
  from s, n;
$$;
