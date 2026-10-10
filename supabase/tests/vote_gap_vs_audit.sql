-- הפער בין הציון האובייקטיבי לקול בודד, ובעיקר הגבול של 30%.
--
-- באותה שיטה של stage0_permissions.sql: הכול בתוך DO אחד שנגמר בזריקת
-- הדוח כשגיאה, כך שכל העסקה מתגלגלת אחורה ושום שורה אינה נשארת.
-- כל שורה חייבת להתחיל ב-PASS.

do $t$
declare
  r     text[] := '{}';
  u     uuid := gen_random_uuid();
  st    uuid;
  aud   uuid;
  v_hi  uuid;
  v_mid uuid;
  v_lo  uuid;
  s     text;
  g     numeric;
begin
  insert into auth.users (id, aud, role, email, is_anonymous, email_confirmed_at, created_at, updated_at, instance_id)
  values (u, 'authenticated', 'authenticated', null, true, null, now(), now(), '00000000-0000-0000-0000-000000000000');

  select id into st from public.streets order by code limit 1;

  -- בדיקה עם ציון אובייקטיבי ידוע: 0.50.
  insert into public.street_audits (street_id, version, run_by, engine_version, state, objective_score)
  values (st, 9999, 'test', 'test', 'draft', 0.50)
  returning id into aud;

  /*
   * שלושה קולות, שכל אחד נופל בצד אחר של הגבול. הציון המנורמל של קול
   * הוא (ממוצע-1)/4, ולכן:
   *   כל התשובות 5  → 1.00, פער 50% מעל הגבול  → אדום
   *   כל התשובות 4  → 0.75, פער 25% מתחת לגבול → ירוק
   *   כל התשובות 1  → 0.00, פער 50%            → אדום
   */
  insert into public.votes (street_id, scores, user_id, is_demo)
  values (st, '{"a":5,"b":5}', u::text || '-hi', false) returning id into v_hi;
  insert into public.votes (street_id, scores, user_id, is_demo)
  values (st, '{"a":4,"b":4}', u::text || '-mid', false) returning id into v_mid;
  insert into public.votes (street_id, scores, user_id, is_demo)
  values (st, '{"a":1,"b":1}', u::text || '-lo', false) returning id into v_lo;

  select round(public.vote_score_norm('{"a":5,"b":5}'::jsonb), 2) into g;
  r := r || array[(case when g = 1.00 then 'PASS' else 'FAIL' end ||
    ' a top rating normalises to 1.00 (got ' || g || ')')]::text[];
  select round(public.vote_score_norm('{"a":1,"b":1}'::jsonb), 2) into g;
  r := r || array[(case when g = 0.00 then 'PASS' else 'FAIL' end ||
    ' a bottom rating normalises to 0.00 (got ' || g || ')')]::text[];

  select state, round(gap, 2) into s, g from public.vote_audit_gaps where vote_id = v_hi;
  r := r || array[(case when s = 'gap' and g = 0.50 then 'PASS' else 'FAIL' end ||
    ' a 50% gap above the measurement is flagged (' || s || ', ' || g || ')')]::text[];

  select state, round(gap, 2) into s, g from public.vote_audit_gaps where vote_id = v_mid;
  r := r || array[(case when s = 'aligned' and g = 0.25 then 'PASS' else 'FAIL' end ||
    ' a 25% gap passes automatically (' || s || ', ' || g || ')')]::text[];

  select state, round(gap, 2) into s, g from public.vote_audit_gaps where vote_id = v_lo;
  r := r || array[(case when s = 'gap' and g = 0.50 then 'PASS' else 'FAIL' end ||
    ' a 50% gap below the measurement is flagged (' || s || ', ' || g || ')')]::text[];

  -- הגבול עצמו: בדיוק 30% עובר, 30% ומשהו נופל.
  update public.street_audits set objective_score = 0.75 - 0.30 where id = aud;
  select state into s from public.vote_audit_gaps where vote_id = v_mid;
  r := r || array[(case when s = 'aligned' then 'PASS' else 'FAIL' end ||
    ' exactly 30% is still "no gap" (' || s || ')')]::text[];

  update public.street_audits set objective_score = 0.75 - 0.31 where id = aud;
  select state into s from public.vote_audit_gaps where vote_id = v_mid;
  r := r || array[(case when s = 'gap' then 'PASS' else 'FAIL' end ||
    ' 31% is already a gap (' || s || ')')]::text[];

  -- רחוב בלי ציון אובייקטיבי אינו מסומן לא אדום ולא ירוק.
  update public.street_audits set objective_score = null where id = aud;
  select state into s from public.vote_audit_gaps where vote_id = v_mid;
  r := r || array[(case when s = 'no_audit' then 'PASS' else 'FAIL' end ||
    ' no measurement means no verdict (' || s || ')')]::text[];

  raise exception E'\n%', array_to_string(r, E'\n');
end $t$;
