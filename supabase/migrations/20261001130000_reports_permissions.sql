-- הרשאות הדיווחים, לפי מודל ההרשאות של Stage 0.
--
-- טבלאות reports ו-report_photos נוצרו לפני שההרשאות ננעלו במסד, ולכן
-- קיבלו מדיניות גורפת ל-anon — בדיוק מה ש-stage0b ביטל בכל שאר הטבלאות.
-- כאן הן מיושרות לאותו מודל: הזהות מגיעה מ-Supabase Auth, והמסד מחליט.
--
--   anon      כלום. דיווח אינו תוכן ציבורי.
--   resident  שולח דיווח משלו, וקורא רק אותו.
--   staff     קורא הכול ומסמן כטופל.

drop policy if exists reports_staff_read       on public.reports;
drop policy if exists app_reports_write        on public.reports;
drop policy if exists report_photos_staff_read on public.report_photos;
drop policy if exists app_report_photos_write  on public.report_photos;

revoke select, insert, update, delete on public.reports from anon;
revoke select, insert, update, delete on public.report_photos from anon;

-- התושב רואה את מה ששלח, הצוות רואה הכול.
create policy reports_read_own_or_staff on public.reports for select to authenticated
  using (user_id = auth.uid()::text or public.is_staff());

create policy reports_insert_own on public.reports for insert to authenticated
  with check (user_id = auth.uid()::text and handled = false);

-- "טופל" הוא החלטה של האגף, ולכן רק הצוות מעדכן. התושב אינו משנה דיווח
-- ששלח: הוא ראיה בזמן נתון, ולא טיוטה.
create policy reports_staff_update on public.reports for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy reports_staff_delete on public.reports for delete to authenticated
  using (public.is_staff());

-- התמונה: נכתבת יחד עם הדיווח שלה, ונקראת בידי הצוות בלבד. אין כאן
-- מסלול פרסום, ולכן גם אין מקביל ל-public_photo_blob.
create policy report_photos_staff_read on public.report_photos for select to authenticated
  using (public.is_staff());

create policy report_photos_insert on public.report_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.reports r
      where r.id = report_id and r.user_id = auth.uid()::text
    )
  );

create policy report_photos_staff_delete on public.report_photos for delete to authenticated
  using (public.is_staff());
