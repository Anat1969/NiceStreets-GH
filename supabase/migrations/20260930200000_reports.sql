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

-- ההרשאות עצמן נקבעות בהגירה שאחריה,
-- 20261001130000_reports_permissions.sql, לפי מודל ההרשאות של Stage 0:
-- anon כלום, התושב שולח וקורא את שלו, הצוות רואה הכול.
--
-- ההגירה הזאת רצה במסד הייצור לפני שההרשאות ננעלו, ולכן יצרה בזמנו
-- מדיניות גורפת ל-anon. היא הוסרה כאן כדי שמסד חדש שיוקם מאפס לא יקבל
-- אותה אפילו לרגע.
