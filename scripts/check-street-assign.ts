/*
 * בדיקה מהירה של השיוך האוטומטי, בלי מסד נתונים:
 *   npx -y esbuild scripts/check-street-assign.ts --bundle --platform=node --format=esm --log-level=warning --alias:@=. | node --input-type=module
 */
import { buildAssignRow, hasPendingSuggestion } from "@/lib/street-assign";

const cases = [
  { code: "119", quarterId: null, typology: null, note: "הורדים: ריק, צריך הצעה חדשה" },
  { code: "181", quarterId: "q-main-axis", typology: "boulevard", note: "ז'בוטינסקי: שמור שונה מהשכבה" },
  { code: null, quarterId: null, typology: null, note: "בלי סמל: אין מידע" },
];

let failed = 0;
for (const c of cases) {
  const row = buildAssignRow({
    id: c.code ?? "x",
    name: c.note,
    code: c.code,
    quarterId: c.quarterId,
    typology: c.typology,
    votes: 0,
    suggestions: c.code === "119" ? [{ key: "neighborhood_commercial", label: "מסחרי שכונתי", count: 2 }] : [],
  });
  console.log(c.note, "|", row.quarter.value, row.quarter.match, "|", row.type.value, row.type.match, "|", row.flags.join(" / "));
  if (c.code === "119" && (!hasPendingSuggestion(row) || row.quarter.value !== "q-a")) failed++;
  if (c.code === null && (row.quarter.match !== "none" || row.flags.length < 2)) failed++;
}
console.log(failed === 0 ? "PASS" : `FAIL ${failed}`);
process.exitCode = failed ? 1 : 0;
