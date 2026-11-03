import Link from "next/link";
import type { CSSProperties } from "react";
import type { MapTableData } from "@/lib/map-table";

/**
 * טבלת הפרטים בלוח שנפתח בלחיצה — אותה טבלה כמו בחלונית הריחוף
 * (lib/map-table.ts). שורה עם קישור היא מטרת מגע מלאה.
 */
export default function MapTable({ data, className = "" }: { data: MapTableData; className?: string }) {
  const style = { "--cols": data.columns.length } as CSSProperties;
  return (
    <div className={`district-table district-table-panel ${className}`} style={style}>
      <span className="district-table-head" />
      {data.columns.map((c) => (
        <span key={c} className="district-table-head district-table-num">
          {c}
        </span>
      ))}
      {data.total ? (
        <>
          <span className="district-table-total">{data.total.label}</span>
          {data.columns.map((c, i) => (
            <span key={c} className="district-table-total district-table-num">
              {data.total?.cells[i] ?? ""}
            </span>
          ))}
        </>
      ) : null}
      {data.rows.map((row, index) =>
        row.href ? (
          <Link key={`${row.label}-${index}`} href={row.href} className="district-table-row">
            <span>{row.label}</span>
            {data.columns.map((c, i) => (
              <span key={c} className="district-table-num">
                {row.cells[i] ?? ""}
              </span>
            ))}
          </Link>
        ) : (
          <div key={`${row.label}-${index}`} className="district-table-row district-table-plain">
            <span>{row.label}</span>
            {data.columns.map((c, i) => (
              <span key={c} className="district-table-num">
                {row.cells[i] ?? ""}
              </span>
            ))}
          </div>
        ),
      )}
    </div>
  );
}
