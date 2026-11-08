-- צפיפות צמתים: סובלנות של כ-3 מ' (ענת אישרה, 09.11.2026).
--
-- בשכבת הרחובות העירונית רחוב צדדי נגמר לפעמים מטרים ספורים לפני הרחוב
-- הראשי במקום לגעת בו. ST_Intersects לא רואה צומת כזה, ולכן "בן אליעזר אריה"
-- (575 מ', 4 קטעים) קיבל "אין נתון". כאן צומת הוא:
--   1. נקודת חיתוך אמיתית עם קטע של רחוב אחר, או
--   2. קצה של קטע של רחוב אחר שנמצא עד ~3 מ' מהרחוב (נקודת הקצה מוטלת על הרחוב).
-- הנקודות מעוגלות ל-~5 מ', כדי שצומת אחד לא ייספר פעמיים.

create or replace function public.audit_intersection_distance(p_street_id uuid)
returns numeric
language sql
stable
set search_path = public, extensions
as $$
  with s as (
    select geom, code from streets where id = p_street_id and geom is not null
  ), others as (
    select g.geom
    from s join gis_segments g
      on ST_DWithin(s.geom, g.geom, 0.00003)
     and coalesce(g.code, '') <> coalesce(s.code, '#')
  ), crossings as (
    select (ST_Dump(ST_Intersection(s.geom, o.geom))).geom p
    from s, others o
    where ST_Intersects(s.geom, o.geom)
  ), ends as (
    select ST_ClosestPoint(s.geom, e.pt) p
    from s, others o,
         lateral (select ST_StartPoint((ST_Dump(o.geom)).geom) pt
                  union all
                  select ST_EndPoint((ST_Dump(o.geom)).geom)) e
    where ST_DWithin(s.geom, e.pt, 0.00003)
  ), near as (
    -- 3. קטע שעובר עד ~3 מ' מהרחוב בלי לגעת בו ובלי שקצהו קרוב (חיתוך "כמעט").
    select ST_ClosestPoint(s.geom, o.geom) p from s, others o
  ), pts as (
    select distinct ST_SnapToGrid(p, 0.00005) p
    from (select p from crossings union all select p from ends union all select p from near) x
    where GeometryType(p) = 'POINT'
  )
  select case when count(pts.p) >= 2
              then round((ST_Length(s.geom::geography) / (count(pts.p) - 1))::numeric, 1) end
  from s left join pts on true
  group by s.geom;
$$;
