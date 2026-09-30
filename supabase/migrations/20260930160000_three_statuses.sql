-- שלושה סטטוסים במקום חמישה.
--
-- "התקבל" ו"בבדיקה" נראו לתושב כאותו דבר, וכך גם "מתוכנן" ו"בביצוע".
-- חמש אפשרויות שבהן הצוות היסס ושהתושב לא ידע לפרש. השורות הקיימות
-- ממופות לשלושת החדשים לפני שהאילוץ מוחלף, כדי שלא תאבד אף רשומה.
--
-- received     → under_review  ("בבדיקה")
-- under_review → under_review
-- planned      → in_progress   ("בטיפול")
-- in_progress  → in_progress
-- done         → done

alter table street_status drop constraint if exists street_status_status_check;

update street_status set status = 'under_review' where status = 'received';
update street_status set status = 'in_progress'  where status = 'planned';

alter table street_status
  add constraint street_status_status_check
  check (status in ('under_review', 'in_progress', 'done'));
