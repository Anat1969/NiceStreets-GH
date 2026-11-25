-- גרעיניות המרקם: יעד למדד "מגרשים קטנים" (ענת, 25.11.2026, המסמך "גרעיניות המרקם העירוני", הצעה לכיול).
--
-- עד עכשיו המדד היה חציון רוחב החזית, בלי ערך יעד. מעכשיו:
--   מגרש קטן = שטח עד 1,000 מ"ר.
--   הערך = אחוז מאורך חזיתות המגרשים לרחוב ששייך למגרשים קטנים (שני הצדדים, כל מגרש נספר פעם אחת).
--   היעד = לפחות 60%, לכל סוגי הרחוב (הצעת עבודה של המסמך, עד כיול מקומי לפי קבוצת ייחוס).
-- חריגים נמדדים בנפרד ולא נכנסים לאחוז: מבני ומוסדות ציבור, שטח ציבורי פתוח, פארק, שביל, חניה, חקלאי.
-- נשמרים גם: רוחב חזית חציוני, מגרשים קטנים ל-100 מ' בצד, אחוז החזית של החריגים, וכיסוי (פער מידע).

create or replace function public.street_small_plots(p_street_id uuid, p_width numeric default null)
returns jsonb
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  g geometry; len float; road geometry; corridor geometry; r jsonb;
begin
  select ST_Transform(ST_LineMerge(geom), 2039) into g from streets where id = p_street_id and geom is not null;
  if g is null then return null; end if;
  len := ST_Length(g);
  if len < 20 then return null; end if;

  select ST_Union(f.geom) into road from shchuna_gis_features f
  where f.layer = 'lots' and f.props->>'use' like 'דרך%' and ST_DWithin(f.geom, g, 40);
  if road is null then return null; end if;
  corridor := ST_Intersection(road, ST_Buffer(g, coalesce(p_width, 20) / 2 + 3, 'endcap=flat'));
  if corridor is null or ST_IsEmpty(corridor) then return null; end if;

  with lot as (
    select ST_Area(f.geom) area,
           ST_Length(ST_Intersection(ST_Boundary(f.geom), ST_Buffer(corridor, 1.5))) fl,
           coalesce(f.props->>'use', '') ~ '(ציבור|פארק|שביל|חניה|חקלאי)' excepted
    from shchuna_gis_features f
    where f.layer = 'lots' and coalesce(f.props->>'use', '') not like 'דרך%'
      and ST_DWithin(f.geom, corridor, 1.5)
  ), l as (select * from lot where fl >= 4)
  select jsonb_build_object(
    'threshold_m2', 1000,
    'small_plot_pct', round((100 * coalesce(sum(fl) filter (where not excepted and area <= 1000), 0)
                      / nullif(sum(fl) filter (where not excepted), 0))::numeric, 1),
    'plots', count(*) filter (where not excepted),
    'small_plots', count(*) filter (where not excepted and area <= 1000),
    'small_per_100m_side', round((count(*) filter (where not excepted and area <= 1000) / (2 * len / 100))::numeric, 1),
    'median_frontage_m', round((percentile_cont(0.5) within group (order by fl) filter (where not excepted))::numeric, 1),
    'excepted_pct', round((100 * sum(fl) filter (where excepted) / nullif(sum(fl), 0))::numeric, 1),
    'coverage', round((sum(fl) / (2 * len))::numeric, 2)
  ) into r from l;
  return r;
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;

grant execute on function public.street_small_plots(uuid, numeric) to authenticated;

update public.criteria set measure = 'smallPlotFrontagePct', unit = '%',
  source = 'שכבת מגרשים, GIS עירוני: אחוז אורך החזית של מגרשים עד 1,000 מ"ר'
where id = 'small_plots';

insert into public.typology_benchmarks (typology, criterion_id, target_min, target_max, placeholder)
select t, 'small_plots', 60, null, false
from unnest(array['boulevard','linear_park','main_commercial','neighborhood_commercial','pedestrian_mall','residential']) t
on conflict do nothing;

-- The engine: measure the share once per audit into the profile, and judge it against the target.
do $mig$
declare d text;
begin
  d := pg_get_functiondef('public.run_street_audit(uuid,text)'::regprocedure);
  d := replace(d, $a$engine   constant text := '0.4-buildings';$a$, $a$engine   constant text := '0.5-small-plots';$a$);
  d := replace(d,
    $a$  select source_date into lots_date from shchuna_gis_layers where id = 'lots';$a$,
    $a$  if prof is not null then
    prof := prof || jsonb_build_object('small_plots', public.street_small_plots(p_street_id, (prof ->> 'row_width_m')::numeric));
  end if;
  select source_date into lots_date from shchuna_gis_layers where id = 'lots';$a$);
  d := replace(d,
    $a$    elsif c.measure = 'plotFrontageM' and (prof ->> 'plot_frontage_m') is not null then
      val := (prof ->> 'plot_frontage_m')::numeric;
      src := 'שכבת מגרשים: חציון ' || (prof ->> 'plots') || ' מגרשים גובלים';
      conf := 'medium'; ddate := lots_date;$a$,
    $a$    elsif c.measure = 'smallPlotFrontagePct' and (prof #>> '{small_plots,small_plot_pct}') is not null then
      val := (prof #>> '{small_plots,small_plot_pct}')::numeric;
      src := 'שכבת מגרשים: ' || (prof #>> '{small_plots,small_plots}') || ' מתוך ' || (prof #>> '{small_plots,plots}')
             || ' מגרשים בחזית עד 1,000 מ"ר; חריגים (ציבור, שצ"פ, שביל) ' || coalesce(prof #>> '{small_plots,excepted_pct}', '0') || '% מהחזית';
      conf := case when (prof #>> '{small_plots,coverage}')::numeric >= 0.6 then 'medium' else 'low' end;
      ddate := lots_date;$a$);
  if position('0.5-small-plots' in d) = 0 or position('smallPlotFrontagePct' in d) = 0 or position('street_small_plots' in d) = 0 then
    raise exception 'run_street_audit: the expected text was not found, nothing changed';
  end if;
  execute d;
end $mig$;
