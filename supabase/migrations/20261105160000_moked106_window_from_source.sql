-- Moked 106: count the last 12 months that are in the loaded file, not the last
-- 12 months before today.
--
-- The first file from the city (05.11.2026) runs until 16.02.2025. Counted back
-- from today, the window held no rows, and every street got "אין נתון" although
-- the data was loaded. The date the engine reports is the last month in the file,
-- so the age of the data stays visible, and the 3-year staleness warning still
-- applies to it.
--
-- The change is an exact text replacement inside the live run_street_audit, so
-- the rest of the function stays as it is (last defined in
-- 20261001170000_vote_gap_vs_audit.sql). The block fails loudly when the text it
-- replaces is not there.

do $mig$
declare
  def text := pg_get_functiondef('public.run_street_audit(uuid,text)'::regprocedure);
  old_window constant text := 'and month >= to_char(now() - interval ''12 months'', ''YYYY-MM'');';
  new_window constant text :=
    'and month > (select to_char(to_date(max(x.month) || ''-01'', ''YYYY-MM-DD'') - interval ''12 months'', ''YYYY-MM'') '
    || 'from moked106_street_counts x where x.topic = split_part(c.measure, '':'', 2));';
  old_label constant text := '''מוקד 106, קבצים חודשיים (גרסה פעילה)''';
  new_label constant text := '''מוקד 106, 12 החודשים האחרונים בקובץ''';
begin
  if position(old_window in def) = 0 or position(old_label in def) = 0 then
    raise exception 'run_street_audit: the moked106 block is not the expected text';
  end if;
  execute replace(replace(def, old_window, new_window), old_label, new_label);
end
$mig$;
