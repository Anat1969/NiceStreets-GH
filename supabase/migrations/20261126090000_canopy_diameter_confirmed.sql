-- חופת עצים: ענת אישרה ב-25.11.2026 ש-canopy_dia (בטבלה המשותפת canopy_m) הוא קוטר הצמרת במטרים.
-- החישוב כבר הניח קוטר (עיגול ברדיוס d/2), ולכן הערכים לא משתנים. משתנה רק הביטחון:
-- בינוני כשלפחות מחצית העצים ברחוב עם קוטר צמרת מדוד, ונמוך כשרובם מוערכים מקוטר הגזע.
do $m$ declare d text; begin
  d := pg_get_functiondef('public.run_street_audit(uuid,text)'::regprocedure);
  d := replace(d, $a$engine   constant text := '0.5-small-plots';$a$, $a$engine   constant text := '0.6-canopy-diameter';$a$);
  d := replace(d,
    $a$      -- Low until the unit of canopy_dia is confirmed (diameter, radius or a size class): every street came out 0-13%.
      conf := 'low';$a$,
    $a$      -- canopy_dia is the crown diameter (confirmed 25.11.2026). Medium when at least half the crowns are measured.
      conf := case when (prof ->> 'trees_with_canopy')::numeric >= 0.5 * nullif((prof ->> 'trees')::numeric, 0) then 'medium' else 'low' end;$a$);
  if position('0.6-canopy-diameter' in d) = 0 or position('confirmed 25.11.2026' in d) = 0 then
    raise exception 'run_street_audit: the expected text was not found, nothing changed';
  end if;
  execute d;
end $m$;
