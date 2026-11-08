/*
 * מקרא אחיד (ענת, 09.11.2026: "תמיד מקרא של שפה מוסכמת").
 * כל מקום שבו צבע, סימן או מספר קטן נושאים משמעות — מקבל את הרכיב הזה
 * ממש לידו, באותו סגנון בכל האפליקציה.
 */
export interface LegendItem {
  /** דוגמה חזותית: צבע רקע, או רכיב (סימן, צ'יפ). */
  swatch?: string;
  mark?: React.ReactNode;
  label: string;
}

export default function Legend({
  title = "מקרא",
  items,
  note,
  className = "",
}: {
  title?: string;
  items: LegendItem[];
  /** הסבר קצר מה המספרים או הצבעים אומרים. */
  note?: string;
  className?: string;
}) {
  return (
    <div className={`legend ${className}`} role="note" aria-label={title}>
      <span className="legend-title">{title}</span>
      <ul className="legend-items">
        {items.map((item) => (
          <li key={item.label}>
            {item.mark ?? (
              <i className="legend-swatch" style={{ background: item.swatch }} aria-hidden="true" />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      {note ? <p className="how legend-note">{note}</p> : null}
    </div>
  );
}
