-- מבנים בדופן הרחוב (16.11.2026, שלב 1 של מילוי המידע החסר).
-- שכבת המבנים (shchuna_gis_features, layer = 'buildings'): טביעות OpenStreetMap עם קומות לפי מקור:
-- osm (מדוד), estimate (חציון באותו רובע וייעוד; בבדיקת השארת-אחד-בחוץ: שגיאה ממוצעת 1.55 קומות, 78% בהפרש עד קומה), unknown.
-- street_profile מוסיף: frontage_buildings, frontage_buildings_measured, buildings_per_100m, mean_floors, height_to_width.
-- המנוע 0.4 מודד building_rhythm (buildingsPer100m) ו-proportions (heightToWidth). יחס שאושר ידנית בדף הרחוב גובר.

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
  sw numeric; sw_cov numeric; v_front numeric; canopy numeric; n_trees int; n_measured int; b_n int; b_known int; b_floors numeric; hw numeric; n_plots int; lights numeric; signals int;
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

  -- Tree canopy over the right of way. Crown = circle of canopy_m (the layer's canopy diameter, read as metres);
  -- where it is missing (42%), estimated from the trunk by the medians of the layer itself:
  -- trunk up to 15 cm = 2 m, up to 35 = 3 m, up to 45 = 5 m, above = 6 m; trunk over 150 cm is a data error = 3 m.
  -- Status 5, 7 and 8 are left out (assumed removed or dead; the codes were not documented).
  if corridor is not null and not ST_IsEmpty(corridor) then
    with t as (
      select f.geom, coalesce(nullif((f.props->>'canopy_m')::numeric, 0),
        case when coalesce((f.props->>'trunk_cm')::numeric, 0) = 0 then 3
             when (f.props->>'trunk_cm')::numeric > 150 then 3
             when (f.props->>'trunk_cm')::numeric <= 15 then 2
             when (f.props->>'trunk_cm')::numeric <= 35 then 3
             when (f.props->>'trunk_cm')::numeric <= 45 then 5 else 6 end) d,
        (f.props->>'canopy_m')::numeric > 0 measured
      from shchuna_gis_features f
      where f.layer = 'trees' and coalesce(f.props->>'status', '1') not in ('5', '7', '8')
        and ST_DWithin(f.geom, corridor, 3)
    )
    select round((coalesce(ST_Area(ST_Intersection(ST_Union(ST_Buffer(geom, d / 2, 8)), corridor)), 0) / nullif(ST_Area(corridor), 0) * 100)::numeric, 1),
           count(*), count(*) filter (where measured)
    into canopy, n_trees, n_measured from t;
  end if;

  -- Frontage buildings: footprints of 30 m2+ within 20 m of the right of way (the first row on both sides).
  -- Rhythm = buildings per 100 m of one side. H/W = mean height (floors x 3.2 m) over the right-of-way width.
  -- Floors come from the buildings layer with their source; b_known = how many have a measured height (OSM or registry).
  if corridor is not null and not ST_IsEmpty(corridor) then
    select count(*), count(*) filter (where f.props->>'floors_source' in ('osm', 'shimur')),
           avg((f.props->>'floors')::numeric)
    into b_n, b_known, b_floors
    from shchuna_gis_features f
    where f.layer = 'buildings' and ST_Area(f.geom) >= 30 and ST_DWithin(f.geom, corridor, 20)
      and not ST_Intersects(ST_PointOnSurface(f.geom), corridor);
    if coalesce(w_lots, w_layer) > 0 and b_floors is not null then
      hw := round(b_floors * 3.2 / coalesce(w_lots, w_layer), 2);
    end if;
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
    'canopy_pct', canopy,
    'trees', n_trees,
    'trees_with_canopy', n_measured,
    'frontage_buildings', b_n,
    'frontage_buildings_measured', b_known,
    'buildings_per_100m', case when b_n is not null then round((b_n / (2 * len / 100))::numeric, 1) end,
    'mean_floors', round(b_floors, 1),
    'height_to_width', hw,
    'lights_per_100m', lights,
    'signal_junctions', signals);
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $$;

grant execute on function public.street_profile(uuid) to authenticated;


update public.criteria set placeholder = false,
  source = 'טביעות מבנים (OpenStreetMap) ושכבת המגרשים, GIS עירוני'
where id = 'building_rhythm';
update public.criteria set placeholder = false,
  source = 'קומות המבנים בדופן (מדוד או הערכה) ורוחב זכות הדרך; יחס שאושר ידנית גובר'
where id = 'proportions';

create or replace function public.run_street_audit(p_street_id uuid, p_run_by text default 'staff')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  engine   constant text := '0.4-buildings';
  s        record;
  c        record;
  v_audit  uuid;
  v_ver    int;
  errs     jsonb := '[]';
  warns    jsonb := '[]';
  prof     jsonb;
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
  obj_sum  numeric := 0;
  r_conf   text;
  note     text;
  lots_date date;
  sw_date  date;
begin
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

  prof := public.street_profile(p_street_id);
  if prof ? 'error' then
    warns := warns || jsonb_build_object('code', 'profile_error', 'text', 'מדידת השכבות העירוניות נכשלה: ' || (prof ->> 'error'));
    prof := null;
  end if;
  select source_date into lots_date from shchuna_gis_layers where id = 'lots';
  select source_date into sw_date from shchuna_gis_layers where id = 'sidewalks';

  select coalesce(max(version), 0) + 1 into v_ver from street_audits where street_id = p_street_id;
  insert into street_audits (street_id, version, run_by, engine_version, state, profile)
  values (p_street_id, v_ver, p_run_by, engine, 'draft', prof)
  returning id into v_audit;

  for c in select * from criteria order by sort loop
    val := null; bmin := null; bmax := null; src := null; ddate := null;
    conf := 'low'; staffonly := false;

    if c.measure = 'intersectionDistanceM' then
      val := audit_intersection_distance(p_street_id);
      if val is not null then
        src := 'קווי אמצע רחובות (PostGIS)'; conf := 'high';
      else
        val := audit_gis_value(p_street_id, 'intersectionDistanceM');
        if val is not null then src := 'הזנה ידנית (streets.gis)'; conf := 'medium'; end if;
      end if;
    elsif c.measure = 'rowWidthM' and (prof ->> 'row_width_m') is not null then
      val := (prof ->> 'row_width_m')::numeric;
      if prof ->> 'row_width_source' = 'lots' then
        src := 'שכבת מגרשים: חציון ' || (prof ->> 'row_samples') || ' חתכים ניצבים';
        conf := case when abs(val - coalesce((prof ->> 'row_width_layer_m')::numeric, val)) <= 2 then 'high' else 'medium' end;
      else
        src := 'שכבת רוחבי הרחוב (F_STRT_WID)'; conf := 'medium';
      end if;
      ddate := lots_date;
    elsif c.measure = 'sidewalkPct' and (prof ->> 'sidewalk_pct') is not null then
      val := (prof ->> 'sidewalk_pct')::numeric;
      src := 'שכבת מדרכות 2021, כיסוי ' || round((prof ->> 'sidewalk_coverage')::numeric * 100) || '% מהרחוב';
      conf := 'medium'; ddate := sw_date;
    elsif c.measure = 'plotFrontageM' and (prof ->> 'plot_frontage_m') is not null then
      val := (prof ->> 'plot_frontage_m')::numeric;
      src := 'שכבת מגרשים: חציון ' || (prof ->> 'plots') || ' מגרשים גובלים';
      conf := 'medium'; ddate := lots_date;
    elsif c.measure = 'buildingsPer100m' and (prof ->> 'buildings_per_100m') is not null and (prof ->> 'frontage_buildings')::int > 0 then
      val := (prof ->> 'buildings_per_100m')::numeric;
      src := 'טביעות מבנים (OpenStreetMap, 11.2026): ' || (prof ->> 'frontage_buildings') || ' מבנים בדופן';
      conf := 'medium'; ddate := date '2026-11-05';
    elsif c.measure = 'heightToWidth' and audit_gis_value(p_street_id, 'heightToWidth') is null
          and (prof ->> 'height_to_width') is not null then
      val := (prof ->> 'height_to_width')::numeric;
      src := 'גובה מבנים בדופן (' || (prof ->> 'frontage_buildings_measured') || ' מתוך ' || (prof ->> 'frontage_buildings')
             || ' מדודים, השאר הערכה) חלקי רוחב זכות הדרך';
      conf := case when (prof ->> 'frontage_buildings_measured')::numeric >= 0.5 * (prof ->> 'frontage_buildings')::numeric then 'medium' else 'low' end;
      ddate := date '2026-11-05';
    elsif c.measure = 'canopyPct' and (prof ->> 'canopy_pct') is not null then
      val := (prof ->> 'canopy_pct')::numeric;
      src := 'שכבת העצים: ' || (prof ->> 'trees') || ' עצים, ל-' || (prof ->> 'trees_with_canopy') || ' מהם קוטר צמרת מדוד';
      -- Low until the unit of canopy_dia is confirmed (diameter, radius or a size class): every street came out 0-13%.
      conf := 'low';
      select source_date into ddate from shchuna_gis_layers where id = 'trees';
    elsif c.measure like 'moked106:%' then
      staffonly := true;
      select sum(count), max(month) into val, src from moked106_street_counts
      where street_id = p_street_id and topic = split_part(c.measure, ':', 2)
        and month > (select to_char(to_date(max(x.month) || '-01', 'YYYY-MM-DD') - interval '12 months', 'YYYY-MM') from moked106_street_counts x where x.topic = split_part(c.measure, ':', 2));
      if val is not null then
        ddate := to_date(src || '-01', 'YYYY-MM-DD');
        src := 'מוקד 106, 12 החודשים האחרונים בקובץ'; conf := 'medium';
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

    if s.typology is not null then
      select target_min, target_max into bmin, bmax
      from typology_benchmarks where typology = s.typology and criterion_id = c.id;
    end if;

    if val is null then
      verdict := 'no_data';
    elsif bmin is null and bmax is null then
      verdict := 'no_data';
      if c.method in ('gis', 'remote_sensing') and s.typology is not null then
        warns := warns || jsonb_build_object('code', 'no_benchmark', 'criterion', c.id,
          'text', 'נמדד ' || c.name_he || ' = ' || round(val, 1) || ', אבל אין ערך יעד לסוג הרחוב הזה, ולכן אין שיפוט.');
      end if;
    elsif (bmin is null or val >= bmin) and (bmax is null or val <= bmax) then
      verdict := 'meets';
    elsif (bmin is null or val >= bmin * 0.85) and (bmax is null or val <= bmax * 1.15) then
      verdict := 'partial';
    else
      verdict := 'below';
    end if;

    m_score := case verdict when 'meets' then 1 when 'partial' then 0.5
                            when 'below' then 0 else null end;

    r_avg := null; r_n := 0; r_conf := 'low';
    if c.vote_key is not null then
      select round(avg((scores ->> c.vote_key)::numeric), 2), count(scores ->> c.vote_key)
      into r_avg, r_n
      from votes where street_id = p_street_id and is_demo = false and scores ? c.vote_key;
    end if;

    if verdict = 'no_data' or r_n = 0 or r_avg is null then
      gap := 'insufficient';
    else
      r_conf := case when r_n >= 10 then 'high' when r_n >= 3 then 'medium' else 'low' end;
      gap := case
        when (r_avg - 1) / 4 - m_score > 0.30 then 'residents_higher'
        when (r_avg - 1) / 4 - m_score < -0.30 then 'residents_lower'
        else 'aligned' end;
    end if;

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
      confidence, data_source, data_date, resident_avg, resident_n, gap_class, resident_confidence,
      needs_field_check, staff_only)
    values (v_audit, c.id, val, bmin, bmax, verdict, conf, src, ddate, r_avg, r_n, gap, r_conf,
      gap in ('residents_higher', 'residents_lower') or verdict = 'below', staffonly);

    if not staffonly and verdict <> 'no_data' then
      n_measured := n_measured + 1;
      obj_sum := obj_sum + m_score;
      if verdict = 'meets' then n_meets := n_meets + 1;
      elsif verdict = 'partial' then n_partial := n_partial + 1;
      else n_below := n_below + 1; end if;
    end if;
  end loop;

  if real_votes < 10 then
    warns := warns || jsonb_build_object('code', 'few_votes',
      'text', 'רק ' || real_votes || ' דירוגים אמיתיים (לא הדגמה). הפער מדווח, אך הביטחון בו נמוך.');
  end if;

  if jsonb_array_length(errs) = 0 then
    note := 'נבדקו ' || n_measured || ' מדדים ב' || s.name || ' מול היעד לסוג הרחוב: '
      || n_meets || ' עומדים ביעד, ' || n_partial || ' חלקית ו-' || n_below || ' מתחת ליעד.';
    if real_votes >= 10 then
      note := note || ' ' || real_votes || ' תושבים דירגו את הרחוב.';
    end if;
  end if;

  update street_audits set
    objective_score = case when n_measured = 0 then null else obj_sum / n_measured end,
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
$function$;
