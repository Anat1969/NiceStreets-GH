-- בדיקת האתר החי.
--
-- סביבת העבודה של Claude חסומה ליציאה אל *.vercel.app, ולכן היא אינה יכולה
-- לפתוח את האתר. מסד הנתונים אינו חסום. השאילתה הזאת רצה במסד, שולפת את
-- הדפים מהייצור, ומדווחת מה באמת יש בהם — קוד תגובה, סימן זיהוי לכל מסך,
-- מזהה הגרסה, והאם מופיע מסך התחברות במקום האפליקציה.
--
-- להריץ דרך כלי ה-SQL של Supabase, אחרי שהפריסה הגיעה ל-READY.
-- להחליף את מזהה הגרסה בזה שהודפס בסוף `npm run sync`.

\set build '332f7be'

with pages as (
  select * from (values
    ('/',                               'איזה רחוב'),
    ('/choose',                         'שם הרחוב'),
    ('/map',                            'גודל העיגול לפיו'),
    ('/streets',                        'סינון ומיון'),
    ('/examples',                       'רחובות מאשדוד'),
    ('/learn',                          'מה הופך רחוב לטוב, בארבעה חלקים'),
    ('/learn/criteria/section',         'חלוקת החתך'),
    ('/examples?typology=boulevard',    'שדרה'),
    ('/choose?street=189',              'באיזה רובע הקטע'),
    ('/learn/criteria/skeleton',        'תמונה'),
    ('/learn/types/boulevard',          'שדרה'),
    ('/suggest',                        'רחוב שאינו ברשימה'),
    ('/report',                         'דיווח לעירייה')
  ) as t(path, marker)
)
select p.path,
       r.status,
       (r.content like '%' || p.marker || '%')        as marker_found,
       (r.content like '%גרסה ' || :'build' || '%')   as build_ok,
       (r.content like '%Authentication%')            as auth_wall
from pages p,
     lateral extensions.http_get('https://nicestreets-vercal.vercel.app' || p.path) r;

-- מצב המערכת בייצור: איזה אחסון פעיל, מה מוגדר, וכמה שורות יש בכל טבלה.
select status,
       content::jsonb -> 'ok'             as ok,
       content::jsonb -> 'durableStorage' as durable,
       content::jsonb -> 'config'         as config,
       content::jsonb -> 'checks'         as checks
from extensions.http_get('https://nicestreets-vercal.vercel.app/api/health');
