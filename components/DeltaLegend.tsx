import Legend from "@/components/Legend";

/*
 * מקרא לצ'יפים הקטנים "+0.4 / −0.2" במפה (ענת, 09.11.2026: "לא ברור לי
 * הנתונים באדום וירוק + −, מהם"). יושב ממש ליד המפה וליד רשימת הדירוג.
 */
export default function DeltaLegend({ average }: { average?: string }) {
  return (
    <Legend
      title="המספר הקטן ליד הציון"
      className="legend-delta"
      items={[
        {
          mark: (
            <span className="district-label-delta" data-sign="up" aria-hidden="true">
              +0.4
            </span>
          ),
          label: "מעל ממוצע העיר",
        },
        {
          mark: (
            <span className="district-label-delta" data-sign="down" aria-hidden="true">
              −0.2
            </span>
          ),
          label: "מתחת לממוצע העיר",
        },
        {
          mark: (
            <span className="district-label-delta" data-sign="flat" aria-hidden="true">
              0.0
            </span>
          ),
          label: "כמו הממוצע",
        },
      ]}
      note={`הפרש מממוצע העיר${average ? ` (${average} מתוך 10)` : ""}, משוקלל לפי מספר הקולות. זה הפרש מהממוצע ולא שינוי לאורך זמן.`}
    />
  );
}
