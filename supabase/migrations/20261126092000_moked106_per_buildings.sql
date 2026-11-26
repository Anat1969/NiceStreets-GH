-- מוקד 106 כציר עומס לצוות (ענת אישרה 25.11.2026, "שלוש עדשות על הרחוב"):
-- הפניות מודדות שימוש ועומס, לא ליקוי, ולכן הן נשארות מחוץ לציון (staff_only, כמו קודם).
-- מה שמשתנה: היחידה. במקום ספירה גולמית, פניות ב-12 החודשים האחרונים בקובץ לכל 10 מבנים בדופן
-- (שכבת buildings, street_profile). כך רחוב צפוף ורחוב ארוך מושווים לפי האנשים שגרים בהם, לא לפי מטרים.
-- רחוב בלי מבנים בדופן נשאר עם הספירה הגולמית, והמקור אומר זאת.

update public.criteria set unit = 'פניות ל-10 מבנים' where measure like 'moked106:%';

do $m$ declare d text; begin
  d := pg_get_functiondef('public.run_street_audit(uuid,text)'::regprocedure);
  d := replace(d, $a$engine   constant text := '0.6-canopy-diameter';$a$, $a$engine   constant text := '0.7-moked-per-buildings';$a$);
  d := replace(d,
    $a$        src := 'מוקד 106, 12 החודשים האחרונים בקובץ'; conf := 'medium';$a$,
    $a$        if coalesce((prof ->> 'frontage_buildings')::numeric, 0) > 0 then
          src := 'מוקד 106, 12 החודשים האחרונים בקובץ: ' || val || ' פניות, ' || (prof ->> 'frontage_buildings') || ' מבנים בדופן';
          val := round(val / ((prof ->> 'frontage_buildings')::numeric / 10), 1);
        else
          src := 'מוקד 106, 12 החודשים האחרונים בקובץ: ספירה גולמית, אין מבנים בדופן';
        end if;
        conf := 'medium';$a$);
  if position('0.7-moked-per-buildings' in d) = 0 or position('פניות, ' in d) = 0 then
    raise exception 'run_street_audit: the expected text was not found, nothing changed';
  end if;
  execute d;
end $m$;

-- פחות מ-10 מבנים בדופן: מכנה קטן מנפח את המספר (הבנים: 5 מבנים, 308 פניות ל-10). ביטחון נמוך.
do $m$ declare d text; begin
  d := pg_get_functiondef('public.run_street_audit(uuid,text)'::regprocedure);
  d := replace(d,
    $a$          src := 'מוקד 106, 12 החודשים האחרונים בקובץ: ספירה גולמית, אין מבנים בדופן';
        end if;
        conf := 'medium';$a$,
    $a$          src := 'מוקד 106, 12 החודשים האחרונים בקובץ: ספירה גולמית, אין מבנים בדופן';
        end if;
        conf := case when coalesce((prof ->> 'frontage_buildings')::numeric, 0) >= 10 then 'medium' else 'low' end;$a$);
  if position('>= 10 then ''medium''' in d) = 0 then raise exception 'not patched'; end if;
  execute d;
end $m$;
