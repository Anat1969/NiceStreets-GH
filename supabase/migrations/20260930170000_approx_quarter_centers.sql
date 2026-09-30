-- מיקום משוער לשלושה אזורים שאינם ב-OpenStreetMap בשם שלהם, ומיקום
-- אמיתי לרובע י"ז שנמצא בכתיב חלופי.
--
-- 'approx' אינו 'osm': זהו מיקום שנקבע ביד כדי שהאזור יופיע במפה בכלל,
-- והמקרא במפה אומר זאת במפורש. הוא ייעלם ברגע ששכבת ה-GIS העירונית
-- תיטען, או שהצוות ימקם מהמסך.

update quarters set center = '[34.6252859,31.768858]'::jsonb,
       center_source = 'osm', schematic = false where id = 'q-q';

update quarters q set center = v.c::jsonb, center_source = 'approx', schematic = false
from (values
  ('q-ind-light',    '[34.6760,31.8210]'),
  ('q-ind-ad-halom', '[34.6750,31.7600]'),
  ('q-cbd-south',    '[34.6450,31.7700]')
) as v(id, c)
where q.id = v.id;
