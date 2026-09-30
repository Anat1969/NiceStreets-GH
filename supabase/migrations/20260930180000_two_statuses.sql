-- שני סטטוסים.
--
-- התחלנו בחמישה, ירדנו לשלושה, וגם "בטיפול" ו"בבדיקה" התבררו כאותו
-- דבר מבחינת התושב: בשניהם האגף עוסק ברחוב ועוד לא קרה בו שינוי בשטח.
-- ההבחנה היחידה שיש לה משמעות אצלו היא בין "עובדים על זה" ל"נגמר".

alter table street_status drop constraint if exists street_status_status_check;

update street_status set status = 'under_review' where status <> 'done';

alter table street_status
  add constraint street_status_status_check
  check (status in ('under_review', 'done'));
