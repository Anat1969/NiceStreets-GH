-- תמונה חלופית של הצוות (ענת, 08.11.2026, סעיף 24).
--
-- כשתמונת תושב נפסלה, איש צוות מעלה תמונה של האגף במקומה. עד כה רק המנהלת
-- יכלה להכניס תמונה ישירות (photos_admin_insert). כאן כל איש צוות יכול להכניס
-- תמונה מסוג 'example' בלבד, מאושרת, ולא הדגמה. 'test' נשאר למנהלת.
-- אין מפתח עוקף: הכתיבה עוברת דרך is_staff() במסד.

drop policy if exists photos_staff_insert on public.photos;
create policy photos_staff_insert on public.photos for insert to authenticated
  with check (
    public.is_staff()
    and source = 'example'
    and status = 'approved'
    and is_demo = false
  );

drop policy if exists photo_blobs_insert on public.photo_blobs;
create policy photo_blobs_insert on public.photo_blobs for insert to authenticated
  with check (
    exists (
      select 1 from public.photos p
      where p.id = photo_id
        and (
          public.is_admin()
          or (public.is_staff() and p.source = 'example')
          or (p.created_by = auth.uid() and p.status = 'pending')
        )
    )
  );
