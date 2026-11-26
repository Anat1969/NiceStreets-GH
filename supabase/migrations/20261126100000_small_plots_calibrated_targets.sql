-- יעד מכויל למגרשים קטנים (ענת, 26.11.2026, "יעדים משולבים"), מתוך מדידת 532 רחובות בעיר (research_small_plots):
--   מגורים 60%   (ערך המסמך. בעיר: חציון 17%, אחוזון 75 = 83%, שמשקף בתים פרטיים ולא מרקם עירוני)
--   שדרה 15%     (אחוזון 75 בעיר: 13%, מעוגל)
--   מסחרי ראשי 20% (אחוזון 75: 20%, רק 2 רחובות בעיר; ברחובות האפליקציה 6% עד 19%)
--   מסחרי שכונתי: בלי יעד. אחוזון 75 = 1%, יעד ריק. המדידה מוצגת בלי שיפוט.
--   מדרחוב ופארק לינארי: נשאר 60% עד שיהיו נתונים (רחוב מדרחוב אחד בעיר, בלי כיסוי).
update public.typology_benchmarks set target_min = 15 where criterion_id = 'small_plots' and typology = 'boulevard';
update public.typology_benchmarks set target_min = 20 where criterion_id = 'small_plots' and typology = 'main_commercial';
delete from public.typology_benchmarks where criterion_id = 'small_plots' and typology = 'neighborhood_commercial';
