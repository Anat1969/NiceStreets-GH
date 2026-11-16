-- מנוע הבדיקה 0.2: שלושה קריטריונים נמדדים משכבות ה-GIS העירוניות דרך street_profile (16.11.2026).
--   row_width (rowWidthM)      רוחב זכות הדרך בין קווי מגרש, משכבת המגרשים. גיבוי: שכבת רוחבי הרחוב.
--   row_split (sidewalkPct)    שיעור המדרכה, משכבת המדרכות 2021, רק כשהיא מכסה 60% מהרחוב.
--   small_plots (plotFrontageM) רוחב חזית מגרש, חציון המגרשים הגובלים.
-- הזנה ידנית ב-streets.gis נשארת גיבוי כשהשכבה לא נותנת ערך.
-- "אין ערך יעד" הופך מחסימה לאזהרה: מדידה בלי יעד היא מידע, ולא סיבה לעצור את כל הבדיקה.
-- street_audits.profile שומר את כל נתוני השכבות (כולל תאורה ורמזורים), לתצוגה ולבדיקה חוזרת.

alter table public.street_audits add column if not exists profile jsonb;

update public.criteria set placeholder = false,
  source = 'שכבת מגרשים (ייעוד "דרך"), GIS עירוני; גיבוי: שכבת רוחבי הרחוב'
where id = 'row_width';
update public.criteria set placeholder = false,
  source = 'שכבת מדרכות (סקר 08.2021) ושכבת מגרשים, GIS עירוני'
where id = 'row_split';
update public.criteria set placeholder = false,
  source = 'שכבת מגרשים, GIS עירוני'
where id = 'small_plots';

create or replace function public.run_street_audit(p_street_id uuid, p_run_by text default 'staff')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  engine   constant text := '0.2-city-layers';
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

-- The latest-audit view carries the layer profile too (a new column goes last in "create or replace view").
create or replace view public.street_audit_latest with (security_invoker = true) as
select distinct on (street_id) id, street_id, version, run_at, run_by, engine_version, state, errors, warnings,
  proposed_status, proposed_note_he, note_source, final_status, final_note_he, reviewed_by, reviewed_at,
  return_reason, acknowledged_warnings, objective_score, profile
from public.street_audits a
order by street_id, version desc;
