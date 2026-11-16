-- בדיקה אוטומטית של קריטריוני הרחוב משכבות ה-GIS העירוניות (ענת, 16.11.2026).
-- השכבות נטענו לטבלה המשותפת shchuna_gis_features (ITM, EPSG:2039, מטרים) של פרויקט ASHDODMAP:
-- lots (מגרשים וייעודים), sidewalks (מדרכות, סקר 2021), street_widths, light_poles, traffic_lights.
-- הטעינה והתיעוד: Anat1969/Shchuna360-GH, scripts/gis ו-CLAUDE.md.
--
-- street_profile(street) מודד את הרחוב פעם אחת ומחזיר:
--   row_width_m   רוחב זכות הדרך: חתכים ניצבים כל 25 מ' לאורך הרחוב, שנחתכים במגרשי "דרך"
--                 (ייעוד שמתחיל ב"דרך"). החציון, כדי שצומת או מפרץ לא יטו את התוצאה.
--                 גיבוי: השדה F_STRT_WID בשכבת רוחבי הרחוב, ממוצע לפי אורך.
--   sidewalk_pct  שיעור המדרכה מזכות הדרך: שטח המדרכות בתוך תחום הדרך לאורך הרחוב, חלקי שטח
--                 תחום הדרך. שכבת המדרכות (סקר 08.2021) חלקית, ולכן נמדד רק כשהסקר מכסה לפחות 60%
--                 מאורך הרחוב (sidewalk_coverage). אחרת null: אין נתון, לא אפס.
--   plot_frontage_m  רוחב חזית מגרש: אורך הגבול של כל מגרש שאינו דרך, הנוגע בתחום הדרך. חציון.
--   lights_per_100m, signal_junctions  נתוני הקשר (תאורה ורמזורים), לא נשפטים מול יעד.

create or replace function public.street_profile(p_street_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  g geometry;     -- the street centreline, ITM
  len float;
  road geometry;  -- road lots near the street
  corridor geometry;
  w_lots numeric; w_layer numeric; n_samples int;
  sw numeric; sw_cov numeric; v_front numeric; n_plots int; lights numeric; signals int;
begin
  select ST_Transform(ST_LineMerge(geom), 2039) into g from streets where id = p_street_id and geom is not null;
  if g is null then return null; end if;
  len := ST_Length(g);
  if len < 20 then return null; end if;

  select ST_Union(f.geom) into road from shchuna_gis_features f
  where f.layer = 'lots' and f.props->>'use' like 'דרך%' and ST_DWithin(f.geom, g, 40);

  -- Width between lot lines from perpendicular transects (80 m long) every 25 m.
  if road is not null then
    with lines as (select (ST_Dump(g)).geom l), pts as (
      select l, ST_LineInterpolatePoint(l, fr) p,
             ST_LineInterpolatePoint(l, greatest(0, fr - 2 / ST_Length(l))) a,
             ST_LineInterpolatePoint(l, least(1, fr + 2 / ST_Length(l))) b
      from lines, generate_series(12.5::numeric, greatest(12.5, ST_Length(l) - 12.5)::numeric, 25::numeric) d, lateral (select d::float8 / ST_Length(l) fr) x
      where ST_Length(l) >= 25
    ), tr as (
      select p, ST_MakeLine(
        ST_Translate(p, -(ST_Y(b) - ST_Y(a)) / ST_Distance(a, b) * 40, (ST_X(b) - ST_X(a)) / ST_Distance(a, b) * 40),
        ST_Translate(p, (ST_Y(b) - ST_Y(a)) / ST_Distance(a, b) * 40, -(ST_X(b) - ST_X(a)) / ST_Distance(a, b) * 40)) t
      from pts where ST_Distance(a, b) > 0
    ), cut as (
      select (select ST_Length(d.geom) from ST_Dump(ST_Intersection(tr.t, road)) d
              where ST_DWithin(d.geom, tr.p, 1) order by ST_Distance(d.geom, tr.p) limit 1) w
      from tr
    )
    select percentile_cont(0.5) within group (order by w), count(*) into w_lots, n_samples
    from cut where w between 4 and 78;
  end if;

  select sum(ST_Length(ST_Intersection(f.geom, ST_Buffer(g, 5))) * (f.props->>'width')::numeric)
         / nullif(sum(ST_Length(ST_Intersection(f.geom, ST_Buffer(g, 5)))), 0)
  into w_layer
  from shchuna_gis_features f, streets s
  where s.id = p_street_id and f.layer = 'street_widths' and f.props->>'code' = s.code
    and f.props->>'width' ~ '^[0-9.]+$' and ST_DWithin(f.geom, g, 5);

  -- The right of way along this street: road lots within half the width (+3 m) of the centreline.
  if road is not null then
    corridor := ST_Intersection(road, ST_Buffer(g, coalesce(w_lots, w_layer, 20) / 2 + 3, 'endcap=flat'));
  end if;

  select round((ST_Length(ST_Intersection(g, ST_Buffer(ST_Union(f.geom), coalesce(w_lots, w_layer, 20) / 2 + 2))) / len)::numeric, 2)
  into sw_cov from shchuna_gis_features f
  where f.layer = 'sidewalks' and ST_DWithin(f.geom, g, coalesce(w_lots, w_layer, 20) / 2 + 2);

  if corridor is not null and not ST_IsEmpty(corridor) and coalesce(sw_cov, 0) >= 0.6 then
    select round((coalesce(sum(ST_Area(ST_Intersection(f.geom, corridor))), 0) / nullif(ST_Area(corridor), 0) * 100)::numeric, 1)
    into sw from shchuna_gis_features f
    where f.layer = 'sidewalks' and ST_Intersects(f.geom, corridor);
  end if;

  if corridor is not null and not ST_IsEmpty(corridor) then
    select percentile_cont(0.5) within group (order by fl), count(*) into v_front, n_plots from (
      select ST_Length(ST_Intersection(ST_Boundary(f.geom), ST_Buffer(corridor, 1.5))) fl
      from shchuna_gis_features f
      where f.layer = 'lots' and coalesce(f.props->>'use', '') not like 'דרך%'
        and ST_DWithin(f.geom, corridor, 1.5)
    ) x where fl >= 4;
  end if;

  select round((count(*) / (len / 100))::numeric, 1) into lights
  from shchuna_gis_features f where f.layer = 'light_poles' and ST_DWithin(f.geom, g, coalesce(w_lots, w_layer, 20) / 2 + 5);
  select count(distinct f.props->>'junction') into signals
  from shchuna_gis_features f where f.layer = 'traffic_lights' and ST_DWithin(f.geom, g, 30);

  return jsonb_build_object(
    'length_m', round(len::numeric),
    'row_width_m', round(coalesce(w_lots, w_layer)::numeric, 1),
    'row_width_source', case when w_lots is not null then 'lots' when w_layer is not null then 'street_widths' end,
    'row_samples', n_samples,
    'row_width_layer_m', round(w_layer::numeric, 1),
    'sidewalk_pct', sw,
    'sidewalk_coverage', coalesce(sw_cov, 0),
    'plot_frontage_m', round(v_front::numeric, 1),
    'plots', n_plots,
    'lights_per_100m', lights,
    'signal_junctions', signals);
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;

grant execute on function public.street_profile(uuid) to authenticated;
