-- Stage 0, part B: lock permissions.
--
-- Runs only after the build that signs people in is live (see stage0a).
-- From here the database, not the app, decides who may do what:
--
--   anon (not signed in)   read streets, quarters, statuses, content images,
--                          votes_public, approved photos (via public_photo_blob).
--   resident (signed in)   + insert/update own votes, insert own pending photos
--                          and their bytes, create a street row (ensure_street).
--   staff                  + everything operational: moderation, status,
--                          assignments, demo data, reading all votes and photos.
--   admin                  + content images and photos published without moderation.

-- ------------------------------------------------------------- drop old
drop policy if exists app_status_write         on public.street_status;
drop policy if exists status_staff_write       on public.street_status;
drop policy if exists status_read              on public.street_status;
drop policy if exists app_votes_write          on public.votes;
drop policy if exists votes_insert_own         on public.votes;
drop policy if exists votes_update_own         on public.votes;
drop policy if exists votes_read               on public.votes;
drop policy if exists votes_staff_delete       on public.votes;
drop policy if exists app_photos_write         on public.photos;
drop policy if exists photos_insert            on public.photos;
drop policy if exists photos_read_approved     on public.photos;
drop policy if exists photos_staff_delete      on public.photos;
drop policy if exists photos_staff_write       on public.photos;
drop policy if exists app_photo_blobs_write    on public.photo_blobs;
drop policy if exists photo_blobs_staff_read   on public.photo_blobs;
drop policy if exists app_content_images_write on public.content_images;
drop policy if exists content_images_read      on public.content_images;
drop policy if exists app_streets_insert       on public.streets;
drop policy if exists streets_insert           on public.streets;
drop policy if exists streets_read             on public.streets;
drop policy if exists streets_staff_write      on public.streets;
drop policy if exists quarters_read            on public.quarters;
drop policy if exists staff_read               on public.staff;

-- ------------------------------------------------------------- streets
create policy streets_read on public.streets for select using (true);
create policy streets_staff_update on public.streets for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- Inserts go through ensure_street() only.

-- ------------------------------------------------------------- quarters
create policy quarters_read on public.quarters for select using (true);
create policy quarters_staff_update on public.quarters for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ------------------------------------------------------------- street_status
create policy status_read on public.street_status for select using (true);
create policy status_staff_insert on public.street_status for insert to authenticated
  with check (public.is_staff());
create policy status_staff_update on public.street_status for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy status_staff_delete on public.street_status for delete to authenticated
  using (public.is_staff());

-- ------------------------------------------------------------- votes
-- The public reads votes_public. The table itself: own row, or staff.
revoke select, insert, update, delete on public.votes from anon;
create policy votes_read_own_or_staff on public.votes for select to authenticated
  using (user_id = auth.uid()::text or public.is_staff());
create policy votes_insert_own on public.votes for insert to authenticated
  with check (user_id = auth.uid()::text and is_demo = false);
create policy votes_update_own on public.votes for update to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text and is_demo = false);
create policy votes_staff_demo_insert on public.votes for insert to authenticated
  with check (public.is_staff() and is_demo = true);
create policy votes_staff_delete on public.votes for delete to authenticated
  using (public.is_staff());

-- ------------------------------------------------------------- photos
create policy photos_read on public.photos for select
  using (
    (status = 'approved' and source in ('resident', 'example') and is_demo = false)
    or created_by = auth.uid()
    or public.is_staff()
  );
create policy photos_resident_insert on public.photos for insert to authenticated
  with check (
    created_by = auth.uid() and status = 'pending'
    and source = 'resident' and is_demo = false
  );
create policy photos_admin_insert on public.photos for insert to authenticated
  with check (public.is_admin());
create policy photos_staff_update on public.photos for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- A resident may withdraw their own photo while it still waits for review
-- (also how a half-saved upload is cleaned up).
create policy photos_delete on public.photos for delete to authenticated
  using (public.is_staff() or (created_by = auth.uid() and status = 'pending'));

-- ------------------------------------------------------------- photo_blobs
-- Staff read only. The public gets approved bytes through public_photo_blob().
revoke select, update, delete on public.photo_blobs from anon;
create policy photo_blobs_staff_read on public.photo_blobs for select to authenticated
  using (public.is_staff());
create policy photo_blobs_insert on public.photo_blobs for insert to authenticated
  with check (
    exists (
      select 1 from public.photos p
      where p.id = photo_id
        and (public.is_admin() or (p.created_by = auth.uid() and p.status = 'pending'))
    )
  );
create policy photo_blobs_staff_delete on public.photo_blobs for delete to authenticated
  using (public.is_staff());

-- ------------------------------------------------------------- content_images
create policy content_images_read on public.content_images for select using (true);
create policy content_images_admin_write on public.content_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- staff
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- spatial_ref_sys: see 20261001085000_stage0_spatial_ref_sys_readonly.sql
