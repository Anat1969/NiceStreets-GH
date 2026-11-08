-- הבדיקה האוטומטית הייתה "חסומה" בכל 15 הרחובות (ענת, 09.11.2026, סעיף 13):
--   no_geom     — לרחוב אין קו אמצע במסד, כי שכבת הרחובות העירונית (rehevot.shp)
--                 נשמרה רק כקובץ באפליקציה (data/streets.geojson) ולא נטענה לטבלה.
--   no_typology — לא נקבע סוג רחוב.
--
-- כאן: 1) הקווים נטענים לטבלה מאותו קובץ, ישירות מ-GitHub (המסד מוריד אותו).
--      2) סוג רחוב מוערך מהשכבה (מידרג וסוג, אותו כלל כמו scripts/build-gis-typology.mjs)
--         נכתב רק לרחוב שאין לו סוג, ומסומן typology_source = 'gis'.
--         סיווג הצוות (typology_source = 'staff') לעולם לא נדרס.
-- הרצה חוזרת בטוחה: אפשר להריץ שוב אחרי עדכון השכבה.

-- רחוב עירוני הוא כמה קטעים, ולכן העמודה מקבלת MultiLineString ולא רק LineString.
alter table public.streets alter column geom type geometry(Geometry, 4326) using geom::geometry(Geometry, 4326);

alter table public.streets add column if not exists typology_source text
  check (typology_source in ('staff', 'gis'));
update public.streets set typology_source = 'staff'
  where typology is not null and typology_source is null;

create or replace function public.load_gis_streets()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  doc jsonb;
  n_geom int;
  n_type int;
begin
  select content::jsonb into doc
  from extensions.http_get('https://raw.githubusercontent.com/Anat1969/nicestreets-vercal/main/data/streets.geojson');

  with f as (
    select e->'properties' p, e->'geometry' g
    from jsonb_array_elements(doc->'features') e
    where coalesce(e->'properties'->>'code', '') <> ''
      and (e->'properties'->>'hierarchy')::numeric not in (9)
  ), per_code as (
    select p->>'code' code,
           ST_Multi(ST_LineMerge(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(g::text), 4326)))) geom
    from f group by 1
  )
  update public.streets s set geom = pc.geom
  from per_code pc
  where s.code = pc.code and s.geom is null;
  get diagnostics n_geom = row_count;

  with f as (
    select p->>'code' code, p->>'name' nm,
           (p->>'hierarchy')::numeric h, (p->>'type')::numeric t,
           ST_Length(ST_SetSRID(ST_GeomFromGeoJSON(g::text), 4326)::geography) len
    from (select e->'properties' p, e->'geometry' g from jsonb_array_elements(doc->'features') e) x
    where coalesce(p->>'code', '') <> ''
  ), typed as (
    select code, len,
      case
        when h in (0, 8, 9) then null
        when nm like 'מדרחוב%' or h = 10 or t = 6 then 'pedestrian_mall'
        when nm like '%טיילת%' then 'linear_park'
        when t = 1 or nm like 'שד %' then 'boulevard'
        when h = 1 then 'main_commercial'
        when t = 3 then 'neighborhood_commercial'
        when h between 2 and 4 then 'residential'
      end ty
    from f
  ), best as (
    select distinct on (code) code, ty
    from (select code, ty, sum(len) l from typed where ty is not null group by 1, 2) z
    order by code, l desc
  )
  update public.streets s set typology = b.ty, typology_source = 'gis'
  from best b
  where s.code = b.code and s.typology is null;
  get diagnostics n_type = row_count;

  return jsonb_build_object('geom', n_geom, 'typology', n_type);
end $$;

revoke all on function public.load_gis_streets() from public, anon, authenticated;
