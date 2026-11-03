/**
 * טבלת הפרטים של המפות — אותה שפה לרובע ולרחוב.
 *
 * כותרות העמודות מופיעות פעם אחת, שורת הסיכום ("כל הרובע", "כל הרחוב")
 * מודגשת, ומתחתיה שורה לכל פריט: רחוב ברובע, או קול ברחוב. כל מספר יושב
 * מתחת לכותרת שלו, ולכן אין צורך לחזור על המילים "ציון" ו"קולות" בכל שורה.
 *
 * כאן הגרסה ל-DOM (חלונית הריחוף של המפה). הגרסה ל-React: components/MapTable.tsx.
 */

export interface MapTableRow {
  label: string;
  cells: string[];
  href?: string;
}

export interface MapTableData {
  columns: string[];
  total?: { label: string; cells: string[] };
  rows: MapTableRow[];
}

/** בחלונית הריחוף אין גלילה, ולכן מספר השורות מוגבל. */
export const TOOLTIP_ROWS = 12;

/**
 * החלונית: כותרת ואחריה הטבלה. נבנית כ-DOM ולא כ-HTML, כדי ששם שמגיע
 * מהנתונים לא יפורש כקוד.
 */
export function tableTooltip(title: string, data: MapTableData): HTMLElement {
  const root = document.createElement("div");
  root.className = "district-tooltip-body";

  const heading = document.createElement("strong");
  heading.textContent = title;
  root.append(heading);

  const table = document.createElement("div");
  table.className = "district-table";
  table.style.setProperty("--cols", String(data.columns.length));
  const row = (label: string, cells: string[], className: string) => {
    const name = document.createElement("span");
    name.className = className;
    name.textContent = label;
    table.append(name);
    data.columns.forEach((_, i) => {
      const cell = document.createElement("span");
      cell.className = `${className} district-table-num`.trim();
      cell.textContent = cells[i] ?? "";
      table.append(cell);
    });
  };
  row("", data.columns, "district-table-head");
  if (data.total) row(data.total.label, data.total.cells, "district-table-total");
  for (const r of data.rows.slice(0, TOOLTIP_ROWS)) row(r.label, r.cells, "");
  root.append(table);

  if (data.rows.length > TOOLTIP_ROWS) {
    const more = document.createElement("span");
    more.className = "district-tooltip-detail";
    more.textContent = `ועוד ${data.rows.length - TOOLTIP_ROWS}. לחיצה מציגה את כולם.`;
    root.append(more);
  }
  return root;
}
