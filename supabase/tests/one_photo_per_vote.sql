-- תמונה אחת לכל קול, ושהחלפה עדיין עובדת.
--
-- באותה שיטה של stage0_permissions.sql: הכול בתוך DO אחד שנגמר בזריקת
-- הדוח כשגיאה, כך שכל העסקה מתגלגלת אחורה ושום שורה אינה נשארת.
-- כל שורה חייבת להתחיל ב-PASS.

do $t$
declare
  r  text[] := '{}';
  u  uuid := gen_random_uuid();
  st uuid;
  v  uuid;
  p1 uuid;
  n  int;
begin
  insert into auth.users (id, aud, role, email, is_anonymous, email_confirmed_at, created_at, updated_at, instance_id)
  values (u, 'authenticated', 'authenticated', null, true, null, now(), now(), '00000000-0000-0000-0000-000000000000');
  select id into st from public.streets order by code limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', u::text)::text, true);
  execute 'set local role authenticated';

  insert into public.votes (street_id, scores, user_id, is_demo)
  values (st, '{"shade":3}', u::text, false) returning id into v;

  insert into public.photos (street_id, vote_id, storage_path, status, source, is_demo)
  values (st, v, 'a.jpg', 'pending', 'resident', false) returning id into p1;
  r := r || array['PASS resident attaches one photo to their vote']::text[];

  begin
    insert into public.photos (street_id, vote_id, storage_path, status, source, is_demo)
    values (st, v, 'b.jpg', 'pending', 'resident', false);
    r := r || array['FAIL a second photo on the same vote was accepted']::text[];
  exception when unique_violation then
    r := r || array['PASS a second photo on the same vote is refused']::text[];
  end;

  -- הצוות מאשר, ואז התושב מחליף. זה המקרה שהצריך את שינוי מדיניות
  -- המחיקה: בלעדיו שליחה חוזרת הייתה נתקעת על תמונה שכבר אושרה.
  execute 'set local role postgres';
  update public.photos set status = 'approved' where id = p1;
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', u::text)::text, true);
  execute 'set local role authenticated';

  delete from public.photos where vote_id = v;
  get diagnostics n = row_count;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end ||
    ' resident may remove their own approved photo to replace it')]::text[];

  insert into public.photos (street_id, vote_id, storage_path, status, source, is_demo)
  values (st, v, 'c.jpg', 'pending', 'resident', false);
  r := r || array['PASS the replacement photo is accepted']::text[];

  select count(*) into n from public.photos where vote_id = v;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end ||
    ' exactly one photo remains on the vote')]::text[];

  execute 'set local role postgres';
  raise exception E'\n%', array_to_string(r, E'\n');
end $t$;
