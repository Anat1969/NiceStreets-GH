-- דיווח לעירייה, והצעת רחוב שאינו ברשימה הרשמית.
--
-- שני המסלולים היחידים שבהם תמונה היא חובה. בדירוג התמונה היא רשות, כי
-- קול בלי תמונה הוא קול מלא ומי שנדרש לצלם פשוט לא ישלח. כאן התמונה היא
-- הדיווח עצמו: מדרכה שבורה שאין לה תמונה אינה דיווח, ורחוב שאינו ברשימה
-- הרשמית אינו ניתן לזיהוי בלעדיה.
--
-- דיווח אינו קול: הוא אינו נספר בציון, אינו מופיע בשום מסך ציבורי, והתמונה
-- שלו אינה עוברת בתור אישור התמונות הציבוריות. לכן היא נשמרת בטבלה נפרדת
-- ולא ב-photos, שהיא הצינור של מה שמתפרסם.

create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  -- issue:             דיווח על משהו שקרה ברחוב קיים.
  -- street_suggestion: הצעת רחוב שאינו ברשימת הרחובות הרשמית.
  kind        text not null check (kind in ('issue','street_suggestion')),
  -- לדיווח: הרחוב. להצעה: null, כי הרחוב עוד אינו קיים במסד.
  street_id   uuid references streets(id) on delete set null,
  street_name text not null default '',
  quarter_id  text references quarters(id),
  body        text not null default '',
  user_id     text not null default '',   -- מזהה אנונימי, כמו בקולות
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists reports_open_idx on reports (handled, created_at desc);

-- הראיה עצמה, base64, כדי שכל מסד הנתונים יישאר יחידה אחת לגיבוי.
create table if not exists report_photos (
  report_id    uuid primary key references reports(id) on delete cascade,
  content_type text not null default 'image/jpeg',
  data_base64  text not null,
  created_at   timestamptz not null default now()
);

alter table reports       enable row level security;
alter table report_photos enable row level security;

-- הציבור אינו קורא דיווחים, גם לא את שלו: אלה פניות לאגף ולא תוכן האתר.
drop policy if exists reports_staff_read on reports;
create policy reports_staff_read on reports for select using (is_staff());

drop policy if exists report_photos_staff_read on report_photos;
create policy report_photos_staff_read on report_photos for select using (is_staff());

-- כל עוד האפליקציה עובדת עם מפתח כפוף ל-RLS, המדיניות כאן חייבת לאפשר לה
-- את כל הפעולות: המסד אינו יכול להבחין בין השרת לבין גולש. מי רואה מה
-- נאכף בקוד האפליקציה, לפי התפקיד שבעוגייה.
drop policy if exists app_reports_write on reports;
create policy app_reports_write on reports for all to anon
  using (true) with check (true);

drop policy if exists app_report_photos_write on report_photos;
create policy app_report_photos_write on report_photos for all to anon
  using (true) with check (true);
