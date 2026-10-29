-- בדיקת ההרשאות של הדיווחים: anon, התושב ששלח, תושב אחר, צוות.
--
-- באותה שיטה של stage0_permissions.sql: הכול בתוך DO אחד שנגמר בזריקת
-- הדוח כשגיאה, כך שכל העסקה מתגלגלת אחורה והמשתמשים המדומים והדיווחים
-- שלהם אינם נשארים. מריצים דרך כלי ה-SQL של Supabase; ה"שגיאה" היא הדוח.
-- כל שורה חייבת להתחיל ב-PASS.

do $test$
declare
  r       text[] := '{}';
  sender  uuid := gen_random_uuid();
  other   uuid := gen_random_uuid();
  staffu  uuid;
  st      uuid;
  rep     uuid;
  n       int;
begin
  -- שני תושבים אנונימיים מדומים. איש הצוות אינו נוצר כאן אלא נלקח
  -- מ-public.staff: הכתובת של האגף כבר קיימת ב-auth.users, והוספה שנייה
  -- שלה נדחית על ייחודיות הכתובת.
  insert into auth.users (id, aud, role, email, is_anonymous, email_confirmed_at, created_at, updated_at, instance_id)
  values
    (sender, 'authenticated', 'authenticated', null, true, null, now(), now(), '00000000-0000-0000-0000-000000000000'),
    (other,  'authenticated', 'authenticated', null, true, null, now(), now(), '00000000-0000-0000-0000-000000000000');

  select user_id into staffu from public.staff order by added_at limit 1;
  if staffu is null then
    raise exception 'אין איש צוות במסד, ואי אפשר לבדוק את צד הצוות.';
  end if;

  select id into st from public.streets order by code limit 1;

  -- ================================================================ anon
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  begin
    select count(*) into n from public.reports;
    r := r || array[('FAIL anon can select reports (' || n || ')')]::text[];
  exception when insufficient_privilege then
    r := r || array['PASS anon cannot select reports']::text[];
  end;

  begin
    insert into public.reports (kind, street_name, body, user_id)
    values ('issue', 'x', 'y', 'x');
    r := r || array['FAIL anon inserted a report']::text[];
  exception when others then
    r := r || array['PASS anon cannot insert a report']::text[];
  end;

  -- ================================================================ התושב ששולח
  execute 'set local role postgres';
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', sender::text)::text,
    true);
  execute 'set local role authenticated';

  insert into public.reports (kind, street_id, street_name, body, user_id)
  values ('issue', st, 'רחוב הבדיקה', 'המדרכה שבורה לאורך כל הקטע.', sender::text)
  returning id into rep;
  r := r || array['PASS resident inserts their own report']::text[];

  insert into public.report_photos (report_id, content_type, data_base64)
  values (rep, 'image/jpeg', 'QQ==');
  r := r || array['PASS resident attaches the photo to their report']::text[];

  select count(*) into n from public.reports where id = rep;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' resident reads their own report')]::text[];

  begin
    select count(*) into n from public.report_photos where report_id = rep;
    r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end ||
      ' resident cannot read report photo bytes')]::text[];
  exception when insufficient_privilege then
    r := r || array['PASS resident cannot read report photo bytes']::text[];
  end;

  update public.reports set handled = true where id = rep;
  get diagnostics n = row_count;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end ||
    ' resident cannot mark their own report handled')]::text[];

  begin
    insert into public.reports (kind, street_name, body, user_id)
    values ('issue', 'x', 'y', other::text);
    r := r || array['FAIL resident inserted a report as someone else']::text[];
  exception when others then
    r := r || array['PASS resident cannot insert a report as someone else']::text[];
  end;

  -- ================================================================ תושב אחר
  execute 'set local role postgres';
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', other::text)::text,
    true);
  execute 'set local role authenticated';

  select count(*) into n from public.reports where id = rep;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end ||
    ' another resident cannot read someone else''s report')]::text[];

  begin
    insert into public.report_photos (report_id, content_type, data_base64)
    values (rep, 'image/jpeg', 'QQ==');
    r := r || array['FAIL another resident attached a photo to a report that is not theirs']::text[];
  exception when others then
    r := r || array['PASS another resident cannot attach a photo to someone else''s report']::text[];
  end;

  -- ================================================================ צוות
  execute 'set local role postgres';
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', staffu::text)::text,
    true);
  execute 'set local role authenticated';

  select count(*) into n from public.reports where id = rep;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' staff reads every report')]::text[];

  select count(*) into n from public.report_photos where report_id = rep;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' staff reads the report photo')]::text[];

  update public.reports set handled = true where id = rep;
  get diagnostics n = row_count;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' staff marks a report handled')]::text[];

  execute 'set local role postgres';
  raise exception E'\n%', array_to_string(r, E'\n');
end
$test$;
