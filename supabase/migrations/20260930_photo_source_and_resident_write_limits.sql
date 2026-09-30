-- מקור התמונה, ומה מותר לכל צד לכתוב.
--
-- source מבדיל בין שלושה סוגים:
--   resident — תושב העלה. מתפרסם רק אחרי אישור.
--   example  — המנהלת העלתה כדוגמה. מתפרסם מיד, ומופיע גם בספריית הדוגמאות.
--   test     — בדיקה. נראה לצוות ולמנהלת בלבד, לעולם לא לציבור, ונמחק עם
--              מחיקת נתוני ההדגמה.

alter table photos
  add column if not exists source text not null default 'resident';

alter table photos drop constraint if exists photos_source_check;
alter table photos
  add constraint photos_source_check
  check (source in ('resident', 'example', 'test'));

create index if not exists photos_source_idx on photos (source);

-- ------------------------------------------------------------------- RLS
--
-- השרת של האפליקציה עובד עם מפתח service_role שעוקף RLS, ולכן ההרשאות
-- האמיתיות של צוות ומנהלת נאכפות בקוד האפליקציה. המדיניות כאן היא שכבת
-- הגנה שנייה: היא מגבילה את מה שאפשר לעשות עם מפתח anon, אם וכאשר האפליקציה
-- תעבור לעבוד איתו, וגם אם המפתח הזה ידלוף.
--
-- לא ניתן להבחין כאן בין צוות למנהלת: אין חשבונות משתמש במסד, והתפקיד נקבע
-- בקוד לפי קוד כניסה. ההבחנה הזאת נאכפת באפליקציה בלבד, וזה נאמר במפורש
-- כדי שלא ייראה שהמסד אוכף משהו שהוא אינו אוכף.

-- תושב: הוספה בלבד, ורק תמונה שממתינה לאישור וממקור resident.
drop policy if exists app_photos_write on photos;

drop policy if exists app_photos_insert_pending on photos;
create policy app_photos_insert_pending on photos for insert to anon
  with check (status = 'pending' and source = 'resident' and is_demo = false);

drop policy if exists app_photos_read on photos;
create policy app_photos_read on photos for select to anon
  using (status = 'approved' and source in ('resident', 'example'));

-- אין מדיניות update או delete ל-anon: שינוי סטטוס ומחיקה שמורים לשרת.

-- תמונות: הוספת הבייטים מותרת, קריאה ומחיקה שמורות לשרת.
drop policy if exists app_photo_blobs_write on photo_blobs;

drop policy if exists app_photo_blobs_insert on photo_blobs;
create policy app_photo_blobs_insert on photo_blobs for insert to anon
  with check (true);
