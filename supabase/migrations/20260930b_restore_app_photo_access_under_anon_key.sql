-- תיקון נסיגה שנגרמה בהגירה הקודמת.
--
-- ההגירה הקודמת הניחה שהאפליקציה עובדת עם מפתח service_role שעוקף RLS.
-- בפועל המפתח שמוגדר ב-Vercel כפוף ל-RLS: אחרי החמרת המדיניות, קריאת
-- התמונות מהאפליקציה החזירה אפס שורות במקום חמש, ותור האישור נותר ריק.
--
-- עם מפתח כפוף ל-RLS אי אפשר להבחין במסד בין השרת לבין גולש: התפקיד קיים
-- רק בעוגייה של האפליקציה. לכן כל עוד זה המפתח, האכיפה של "מי רואה מה"
-- ו"מי מאשר" היא בקוד האפליקציה בלבד, והמדיניות כאן חייבת לאפשר לאפליקציה
-- לעבוד. ברגע שיוגדר מפתח service_role אפשר להחזיר את הגרסה המחמירה.

drop policy if exists app_photos_read on photos;
drop policy if exists app_photos_insert_pending on photos;

drop policy if exists app_photos_write on photos;
create policy app_photos_write on photos for all to anon
  using (true) with check (true);

drop policy if exists app_photo_blobs_insert on photo_blobs;

drop policy if exists app_photo_blobs_write on photo_blobs;
create policy app_photo_blobs_write on photo_blobs for all to anon
  using (true) with check (true);
