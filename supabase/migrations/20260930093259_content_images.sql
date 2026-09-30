-- תמונות תוכן: תמונה אחת לכל מקום קבוע באפליקציה.
--
-- טבלת photos קושרת כל תמונה לרחוב, ולכן אינה יכולה להחזיק תמונה של
-- קריטריון, של סוג רחוב, של דוגמה בספרייה או את לוגו העירייה. כאן כל
-- תמונה מזוהה במפתח המקום שלה — למשל criterion:tree_canopy — ויש בדיוק
-- אחת לכל מקום.
--
-- הבייטים נשמרים כאן כ-base64 כמו ב-photo_blobs, כדי שכל מסד הנתונים
-- יישאר יחידה אחת לגיבוי ולשחזור.

create table if not exists content_images (
  slot          text primary key,
  content_type  text not null,
  data_base64   text not null,
  alt           text not null default '',
  updated_at    timestamptz not null default now()
);

alter table content_images enable row level security;

-- הציבור קורא; הכתיבה נעשית מהשרת בלבד, והתפקיד נאכף בקוד האפליקציה.
drop policy if exists content_images_read on content_images;
create policy content_images_read on content_images for select using (true);

drop policy if exists app_content_images_write on content_images;
create policy app_content_images_write on content_images for all to anon
  using (true) with check (true);
