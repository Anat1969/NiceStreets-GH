-- הפער בין הבדיקה האובייקטיבית לכל קול של תושב.
--
-- עד כאן הבדיקה האוטומטית השוותה את המדידה לממוצע דירוגי התושבים, ורק
-- כשהיו 10 מדרגים ומעלה. בפועל יש 1–3 קולות לרחוב, ולכן אף פער לא דווח.
--
-- מכאן:
--   1. לכל בדיקה נשמר ציון אובייקטיבי אחד לרחוב (0..1) — ממוצע ציוני
--      המדידה של הקריטריונים שנמדדו.
--   2. כל קול נבדק מול הציון הזה. פער גדול מ-30% מסומן באדום ומדווח
--      לצוות עם קישור לקול; פער של 30% ומטה מסומן ירוק ועובר אוטומטית
--      ל"אין פערים".
--   3. הסף של 10 מדרגים ירד. הפער מדווח מהקול הראשון, והביטחון בו
--      נשמר לצד הפער ומסומן.
--
-- מה שאינו משתנה: **כל הקולות נספרים בציון הרחוב, בלי קשר לבדיקה**.
-- הסימון הוא דיווח לצוות על פער, ולא סינון של דעות.

alter table public.street_audits
  add column if not exists objective_score numeric;

alter table public.audit_results
  add column if not exists resident_confidence text
    check (resident_confidence is null or resident_confidence in ('high', 'medium', 'low'));

-- התצוגה הוגדרה כ-"select a.*", והכוכבית נפתחה לרשימת עמודות בזמן
-- היצירה — ולכן עמודה חדשה אינה מופיעה בה מעצמה. בלי הבנייה מחדש,
-- objective_score פשוט אינו קיים למי שקורא דרכה.
--
-- "create or replace" ולא drop ואחריו create: עמודה חדשה שנוספה בסוף
-- מותרת בהחלפה, והיא גם הדרך שאינה דורשת נעילה בלעדית על התצוגה.
create or replace view public.street_audit_latest
with (security_invoker = true) as
  select distinct on (a.street_id) a.*
  from public.street_audits a
  order by a.street_id, a.version desc;
grant select on public.street_audit_latest to authenticated;


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
  -- סכום ציוני המדידה (1 / 0.5 / 0), שממנו נגזר הציון האובייקטיבי של
  -- הרחוב. הוא נשמר על הבדיקה, וכל קול נבדק מולו.
  obj_sum  numeric := 0;
  r_conf   text;
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

    -- ציון המדידה של הקריטריון, על סולם 0..1.
    m_score := case verdict when 'meets' then 1 when 'partial' then 0.5
                            when 'below' then 0 else null end;

    -- ------------------------------------------------ residents
    r_avg := null; r_n := 0; r_conf := 'low';
    if c.vote_key is not null then
      select round(avg((scores ->> c.vote_key)::numeric), 2), count(scores ->> c.vote_key)
      into r_avg, r_n
      from votes where street_id = p_street_id and is_demo = false and scores ? c.vote_key;
    end if;

    /*
     * הפער מדווח מהקול הראשון, ולא רק מ-10 מדרגים.
     *
     * הסף הקודם השתיק את ההשוואה לגמרי כשהיו מעט קולות, וכך בפועל אף
     * פער לא דווח. מה שמעט קולות משנים הוא את הביטחון במספר, לא את
     * קיומו — ולכן הביטחון נשמר לצד הפער, והצוות שופט לפיו.
     */
    if verdict = 'no_data' or r_n = 0 or r_avg is null then
      gap := 'insufficient';
    else
      r_conf := case when r_n >= 10 then 'high' when r_n >= 3 then 'medium' else 'low' end;
      gap := case
        when (r_avg - 1) / 4 - m_score > 0.30 then 'residents_higher'
        when (r_avg - 1) / 4 - m_score < -0.30 then 'residents_lower'
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
    -- הציון האובייקטיבי של הרחוב, 0..1: ממוצע ציוני המדידה של
    -- הקריטריונים שנמדדו ואינם לצוות בלבד. זה הנתון שכל קול נבדק מולו.
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
$$;


-- ================================================ הציון המנורמל של קול
-- ממוצע התשובות על סולם 1–5, מנורמל ל-0..1, כדי שיהיה בר-השוואה לציון
-- האובייקטיבי. נגזר מהערכים עצמם ולא מרשימת שאלות קבועה, כדי שלא יישבר
-- כששאלה נוספת או יורדת.
create or replace function public.vote_score_norm(p_scores jsonb)
returns numeric language sql immutable as $$
  select case when count(*) = 0 then null
              else (avg(value::numeric) - 1) / 4 end
  from jsonb_each_text(p_scores) as t(key, value)
  where value ~ '^[0-9]+(\.[0-9]+)?$';
$$;

-- ================================================ הפער לכל קול
-- security_invoker: התצוגה נקראת בהרשאות של מי ששואל, ולכן מדיניות
-- הקולות חלה עליה — הצוות רואה הכול, תושב רואה את שלו בלבד.
create or replace view public.vote_audit_gaps
with (security_invoker = true) as
select v.id                             as vote_id,
       v.street_id,
       s.name                           as street_name,
       v.updated_at,
       v.is_demo,
       a.id                             as audit_id,
       a.run_at                         as audited_at,
       a.objective_score,
       public.vote_score_norm(v.scores) as resident_score,
       abs(public.vote_score_norm(v.scores) - a.objective_score) as gap,
       case
         when a.objective_score is null or public.vote_score_norm(v.scores) is null
           then 'no_audit'
         when abs(public.vote_score_norm(v.scores) - a.objective_score) > 0.30
           then 'gap'
         else 'aligned'
       end                              as state,
       (select count(*) from public.votes v2
         where v2.street_id = v.street_id and v2.is_demo = false) as street_votes
from public.votes v
join public.streets s on s.id = v.street_id
left join public.street_audit_latest a on a.street_id = v.street_id;

grant select on public.vote_audit_gaps to authenticated;
