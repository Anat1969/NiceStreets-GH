-- תיקון ל-20261125120000: רחוב שיש לו מגרשים בחזית ואף אחד מהם אינו קטן מקבל 0%, לא "אין נתון".
-- הקובץ הקודם כבר כולל את התיקון; כאן הוא מוחל על מסד שבו הגרסה הראשונה כבר רצה.
do $m$ declare d text; begin
  d := pg_get_functiondef('public.street_small_plots(uuid,numeric)'::regprocedure);
  d := replace(d, 'round((100 * sum(fl) filter (where not excepted and area <= 1000)', 'round((100 * coalesce(sum(fl) filter (where not excepted and area <= 1000), 0)');
  if position('coalesce(sum(fl) filter' in d) = 0 then raise exception 'not patched'; end if;
  execute d;
end $m$;
