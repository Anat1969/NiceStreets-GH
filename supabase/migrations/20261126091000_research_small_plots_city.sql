-- כיול היעד למגרשים קטנים (ענת אישרה 25.11.2026): מדידה על כל רחובות העיר, כמחקר ולא כבדיקה.
-- הבדיקה עצמה נשארת על הרחובות שבאפליקציה בלבד (כלל 17.11.2026). כאן רק טבלת מחקר, לצוות.
--   קו הרחוב: כל קטעי סמל הרחוב בשכבת streets המשותפת, בלי מידרג 8 ו-9. רחוב קצר מ-100 מ' לא נמדד.
--   רוחב: ממוצע F_STRT_WID של הסמל בשכבת street_widths, ובלעדיו 20 מ'.
--   סוג הרחוב: הערכה מהמידרג והסוג, לפי רוב האורך, באותו כלל של scripts/build-gis-typology.mjs.
--   המדד: זהה ל-street_small_plots (אחוז החזית של מגרשים עד 1,000 מ"ר, בלי ציבור, שצ"פ, שביל, חניה וחקלאי).

create table if not exists public.research_small_plots (
  code text primary key,
  name text,
  typology_est text,
  len_m int,
  small_plot_pct numeric,
  plots int,
  small_plots int,
  coverage numeric,
  computed_at timestamptz default now()
);
alter table public.research_small_plots enable row level security;
drop policy if exists research_small_plots_staff_read on public.research_small_plots;
create policy research_small_plots_staff_read on public.research_small_plots for select using (public.is_staff());

create or replace function public.small_plots_for_line(g geometry, p_width numeric)
returns jsonb language plpgsql stable set search_path = public, extensions as $$
declare road geometry; corridor geometry; len float := ST_Length(g); r jsonb;
begin
  select ST_Union(f.geom) into road from shchuna_gis_features f
  where f.layer = 'lots' and f.props->>'use' like 'דרך%' and ST_DWithin(f.geom, g, 40);
  if road is null then return null; end if;
  corridor := ST_Intersection(road, ST_Buffer(g, coalesce(p_width, 20) / 2 + 3, 'endcap=flat'));
  if corridor is null or ST_IsEmpty(corridor) then return null; end if;
  with l as (
    select ST_Area(f.geom) area,
           ST_Length(ST_Intersection(ST_Boundary(f.geom), ST_Buffer(corridor, 1.5))) fl,
           coalesce(f.props->>'use', '') ~ '(ציבור|פארק|שביל|חניה|חקלאי)' excepted
    from shchuna_gis_features f
    where f.layer = 'lots' and coalesce(f.props->>'use', '') not like 'דרך%' and ST_DWithin(f.geom, corridor, 1.5)
  )
  select jsonb_build_object(
    'small_plot_pct', round((100 * coalesce(sum(fl) filter (where not excepted and area <= 1000), 0)
                      / nullif(sum(fl) filter (where not excepted), 0))::numeric, 1),
    'plots', count(*) filter (where not excepted),
    'small_plots', count(*) filter (where not excepted and area <= 1000),
    'coverage', round((sum(fl) / (2 * len))::numeric, 2)) into r
  from l where fl >= 4;
  return r;
exception when others then return jsonb_build_object('error', SQLERRM);
end $$;

-- Measures the next p_limit city streets that are not in the research table yet. Returns how many it measured.
create or replace function public.research_small_plots_run(p_limit int default 15)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare c record; n int := 0; res jsonb; w numeric;
begin
  for c in
    with seg as (
      select props->>'code' code, props->>'name' name, coalesce((props->>'hierarchy')::int, 0) h,
             coalesce((props->>'type')::int, 0) t, geom
      from shchuna_gis_features
      where layer = 'streets' and coalesce(props->>'code', '') not in ('', '0', '1')
        and coalesce((props->>'hierarchy')::int, 0) not in (8, 9)
    ), cls as (
      select code, case
        when h = 10 or t = 6 then 'pedestrian_mall'
        when t = 1 or name like 'שד %' then 'boulevard'
        when h = 1 then 'main_commercial'
        when t = 3 then 'neighborhood_commercial'
        when h between 2 and 4 then 'residential' end typ, sum(ST_Length(geom)) l
      from seg group by 1, 2
    )
    select s.code, min(s.name) name, ST_LineMerge(ST_Union(s.geom)) g,
           (select typ from cls where cls.code = s.code and typ is not null order by l desc limit 1) typ
    from seg s
    where not exists (select 1 from research_small_plots r where r.code = s.code)
    group by s.code
    having sum(ST_Length(s.geom)) >= 100
    order by s.code
    limit p_limit
  loop
    select avg((f.props->>'width')::numeric) into w from shchuna_gis_features f
    where f.layer = 'street_widths' and f.props->>'code' = c.code and f.props->>'width' ~ '^[0-9.]+$';
    res := public.small_plots_for_line(c.g, w);
    insert into research_small_plots (code, name, typology_est, len_m, small_plot_pct, plots, small_plots, coverage)
    values (c.code, c.name, c.typ, round(ST_Length(c.g)), (res->>'small_plot_pct')::numeric,
            (res->>'plots')::int, (res->>'small_plots')::int, (res->>'coverage')::numeric)
    on conflict (code) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.research_small_plots_run(int) from public, anon, authenticated;
