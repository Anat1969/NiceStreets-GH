-- Permission tests for stage 0: anon, resident, other resident, staff.
--
-- Everything runs inside one DO block and ends by raising the report as an
-- exception, so the whole transaction rolls back: the fake users, their votes
-- and photos never persist. Run it through the Supabase SQL tool; the "error"
-- text IS the report. Every line must start with PASS.
--
-- To test the policies before they are live, paste the body of
-- 20261001091000_stage0b_lock_permissions.sql at the marked line.

do $test$
declare
  r      text[] := '{}';
  resid  uuid := gen_random_uuid();
  other  uuid := gen_random_uuid();
  staffu uuid := gen_random_uuid();
  st     uuid;
  v_id   uuid;
  p_pending uuid;
  p_approved uuid;
  n      int;
  ok     boolean;

  procedure_note text;
begin
  -- ---------------------------------------------------------------- setup (as owner)
  -- STAGE0B_POLICIES_GO_HERE

  insert into auth.users (id, aud, role, email, is_anonymous, email_confirmed_at, created_at, updated_at, instance_id)
  values
    (resid,  'authenticated', 'authenticated', null, true,  null,  now(), now(), '00000000-0000-0000-0000-000000000000'),
    (other,  'authenticated', 'authenticated', null, true,  null,  now(), now(), '00000000-0000-0000-0000-000000000000'),
    (staffu, 'authenticated', 'authenticated', 'shtanat5@gmail.com', false, now(), now(), now(), '00000000-0000-0000-0000-000000000000');

  select count(*) into n from public.staff where user_id = staffu and role = 'admin';
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' trigger links invited e-mail to staff as admin')]::text[];

  select id into st from public.streets order by code limit 1;
  insert into public.photos (id, street_id, storage_path, status, source, is_demo, created_by)
  values (gen_random_uuid(), st, 'x/approved.jpg', 'approved', 'resident', false, other)
  returning id into p_approved;
  insert into public.photo_blobs (photo_id, content_type, data_base64) values (p_approved, 'image/jpeg', 'QQ==');
  insert into public.photos (id, street_id, storage_path, status, source, is_demo, created_by)
  values (gen_random_uuid(), st, 'x/pending.jpg', 'pending', 'resident', false, other)
  returning id into p_pending;
  insert into public.photo_blobs (photo_id, content_type, data_base64) values (p_pending, 'image/jpeg', 'QQ==');
  insert into public.votes (street_id, scores, user_id, is_demo)
  values (st, '{"shade":3}', other::text, false);

  -- ================================================================ ANON
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  select count(*) into n from public.streets;
  r := r || array[(case when n > 0 then 'PASS' else 'FAIL' end || ' anon reads streets')]::text[];
  select count(*) into n from public.votes_public;
  r := r || array[(case when n > 0 then 'PASS' else 'FAIL' end || ' anon reads votes_public')]::text[];

  begin
    select count(*) into n from public.votes;
    r := r || array[('FAIL anon can select votes table (' || n || ')')]::text[];
  exception when insufficient_privilege then
    r := r || array['PASS anon cannot select votes table']::text[];
  end;

  begin
    insert into public.votes (street_id, scores, user_id) values (st, '{}', 'x');
    r := r || array['FAIL anon inserted a vote']::text[];
  exception when others then r := r || array['PASS anon cannot insert votes']::text[];
  end;

  begin
    update public.street_status set public_note = 'hack';
    get diagnostics n = row_count;
    r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' anon cannot update street_status (' || n || ' rows)')]::text[];
  exception when others then r := r || array['PASS anon cannot update street_status']::text[];
  end;

  begin
    insert into public.street_status (street_id, status) values (st, 'done')
      on conflict (street_id) do update set status = 'done';
    r := r || array['FAIL anon upserted street_status']::text[];
  exception when others then r := r || array['PASS anon cannot insert street_status']::text[];
  end;

  begin
    delete from public.content_images;
    get diagnostics n = row_count;
    r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' anon cannot delete content_images (' || n || ')')]::text[];
  exception when others then r := r || array['PASS anon cannot delete content_images']::text[];
  end;

  begin
    select count(*) into n from public.photo_blobs;
    r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' anon reads no photo_blobs (' || n || ')')]::text[];
  exception when insufficient_privilege then r := r || array['PASS anon cannot select photo_blobs']::text[];
  end;

  select count(*) into n from public.public_photo_blob(p_approved);
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' anon gets approved photo bytes via public_photo_blob')]::text[];
  select count(*) into n from public.public_photo_blob(p_pending);
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' anon never gets pending photo bytes')]::text[];

  select count(*) into n from public.photos where id = p_pending;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' anon does not see pending photo row')]::text[];

  begin
    perform public.ensure_street('999999', 'בדיקה');
    r := r || array['FAIL anon created a street']::text[];
  exception when others then r := r || array['PASS anon cannot create streets']::text[];
  end;

  begin
    delete from public.spatial_ref_sys where srid = 2039;
    r := r || array['FAIL anon deleted from spatial_ref_sys']::text[];
  exception when others then r := r || array['PASS anon cannot write spatial_ref_sys']::text[];
  end;
  begin
    truncate public.spatial_ref_sys;
    r := r || array['FAIL anon truncated spatial_ref_sys']::text[];
  exception when others then r := r || array['PASS anon cannot truncate spatial_ref_sys']::text[];
  end;
  begin
    select count(*) into n from public.staff_invites;
    r := r || array['FAIL anon reads staff_invites']::text[];
  exception when insufficient_privilege then r := r || array['PASS anon cannot read staff_invites']::text[];
  end;

  execute 'reset role';

  -- ================================================================ RESIDENT
  perform set_config('request.jwt.claims',
    json_build_object('sub', resid, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  execute 'set local role authenticated';

  insert into public.votes (street_id, scores, user_id) values (st, '{"shade":4}', resid::text)
  returning id into v_id;
  r := r || array['PASS resident inserts own vote']::text[];

  update public.votes set reason = 'עדכון' where id = v_id;
  get diagnostics n = row_count;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' resident updates own vote')]::text[];

  update public.votes set reason = 'hack' where user_id = other::text;
  get diagnostics n = row_count;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident cannot update another vote (' || n || ')')]::text[];

  select count(*) into n from public.votes;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' resident sees only own vote row (' || n || ')')]::text[];

  begin
    insert into public.votes (street_id, scores, user_id) values (st, '{}', other::text);
    r := r || array['FAIL resident inserted a vote as someone else']::text[];
  exception when others then r := r || array['PASS resident cannot vote as someone else']::text[];
  end;

  begin
    insert into public.votes (street_id, scores, user_id, is_demo) values (st, '{}', resid::text, true);
    r := r || array['FAIL resident inserted a demo vote']::text[];
  exception when others then r := r || array['PASS resident cannot insert demo votes']::text[];
  end;

  begin
    insert into public.photos (street_id, storage_path, status, source) values (st, 'x', 'pending', 'resident')
    returning id into v_id;
    insert into public.photo_blobs (photo_id, data_base64) values (v_id, 'QQ==');
    r := r || array['PASS resident inserts pending photo and its bytes']::text[];
  exception when others then r := r || array[('FAIL resident pending photo: ' || sqlerrm)]::text[];
  end;

  begin
    insert into public.photos (street_id, storage_path, status, source) values (st, 'x', 'approved', 'resident');
    r := r || array['FAIL resident inserted an approved photo']::text[];
  exception when others then r := r || array['PASS resident cannot insert approved photos']::text[];
  end;

  begin
    insert into public.photo_blobs (photo_id, data_base64) values (p_approved, 'QQ==')
      on conflict (photo_id) do nothing;
    get diagnostics n = row_count;
    r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident cannot attach bytes to others'' photo')]::text[];
  exception when others then r := r || array['PASS resident cannot attach bytes to others'' photo']::text[];
  end;

  update public.photos set status = 'approved' where id = p_pending;
  get diagnostics n = row_count;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident cannot approve photos (' || n || ')')]::text[];

  update public.street_status set public_note = 'hack';
  get diagnostics n = row_count;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident cannot update street_status (' || n || ')')]::text[];

  update public.streets set typology = 'boulevard' where id = st;
  get diagnostics n = row_count;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident cannot update streets (' || n || ')')]::text[];

  begin
    perform public.ensure_street('999998', 'רחוב בדיקה');
    r := r || array['PASS resident can create a new street row via ensure_street']::text[];
  exception when others then r := r || array[('FAIL resident ensure_street: ' || sqlerrm)]::text[];
  end;

  begin
    perform public.ensure_street('drop table', 'x');
    r := r || array['FAIL ensure_street accepted a malformed code']::text[];
  exception when others then r := r || array['PASS ensure_street rejects malformed codes']::text[];
  end;

  select count(*) into n from public.staff;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident sees no staff rows')]::text[];

  select count(*) into n from public.photo_blobs;
  r := r || array[(case when n = 0 then 'PASS' else 'FAIL' end || ' resident reads no photo_blobs (' || n || ')')]::text[];

  execute 'reset role';

  -- ================================================================ STAFF
  perform set_config('request.jwt.claims',
    json_build_object('sub', staffu, 'role', 'authenticated', 'email', 'shtanat5@gmail.com')::text, true);
  execute 'set local role authenticated';

  select public.is_staff() and public.is_admin() into ok;
  r := r || array[(case when ok then 'PASS' else 'FAIL' end || ' staff is_staff() and is_admin()')]::text[];

  select count(*) into n from public.votes;
  r := r || array[(case when n >= 2 then 'PASS' else 'FAIL' end || ' staff reads all votes (' || n || ')')]::text[];

  update public.photos set status = 'approved' where id = p_pending;
  get diagnostics n = row_count;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' staff approves a photo')]::text[];

  select count(*) into n from public.photo_blobs;
  r := r || array[(case when n >= 2 then 'PASS' else 'FAIL' end || ' staff reads photo_blobs')]::text[];

  insert into public.street_status (street_id, status, public_note, updated_by)
  values (st, 'under_review', 'בדיקה', 'test')
  on conflict (street_id) do update set public_note = 'בדיקה';
  r := r || array['PASS staff writes street_status']::text[];

  insert into public.votes (street_id, scores, user_id, is_demo) values (st, '{}', 'demo-user-test', true);
  r := r || array['PASS staff inserts demo votes']::text[];

  update public.streets set typology = typology where id = st;
  get diagnostics n = row_count;
  r := r || array[(case when n = 1 then 'PASS' else 'FAIL' end || ' staff updates streets')]::text[];

  execute 'reset role';

  raise exception E'REPORT (rolled back)\n%', array_to_string(r, E'\n');
end
$test$;
