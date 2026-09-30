-- מיקומים אמיתיים למפה, מ-OpenStreetMap.
--
-- קודם לכן המפה הראתה ריבועים סכמטיים, והם הוסרו כי מיקום מומצא גרוע
-- ממפה חסרה. כאן המיקום נשלף מ-OpenStreetMap לפי שם הרחוב או הרובע,
-- והעמודה `*_source` שומרת מאיפה — כדי שלעולם לא ייראה כמו שכבת GIS
-- עירונית כשאינו כזה.
--
-- 'osm'      — התאמה חד-משמעית ב-OpenStreetMap.
-- 'streets'  — רובע שאין לו התאמה, וממוקם בממוצע הרחובות שכבר מוקמו בו.
-- 'municipal'— שכבת ה-GIS של העירייה, כשתיטען. גוברת על השאר.
-- 'staff'    — מיקום ידני ממסך המפה.

alter table streets  add column if not exists center jsonb;
alter table streets  add column if not exists center_source text;
alter table quarters add column if not exists center_source text;

comment on column streets.center is 'מרכז הרחוב כ-[lon, lat]. המקור ב-center_source.';
comment on column streets.center_source is
  'osm = OpenStreetMap/Nominatim; municipal = שכבת GIS עירונית; staff = מיקום ידני.';
comment on column quarters.center_source is
  'osm | streets | municipal | staff. ראו את ההסבר בראש ההגירה.';
