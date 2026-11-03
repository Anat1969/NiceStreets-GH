/**
 * בדיקת מדידת החתך על נתוני OpenStreetMap שמורים, מול רוחב ידוע מה-GIS
 * העירוני. מריצים: node --experimental-strip-types scripts/check-street-section.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";

/* ייבוא בלי סיומת, כמו ש-Next.js פותר אותו: "./street-name" הופך ל-".ts". */
register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, next) {" +
        "try { return await next(s, c); } catch (e) {" +
        "if (s.startsWith('.')) return next(s + '.ts', c); throw e; } }",
    ),
);
const { measureSection, parseRatioRange, ratioVerdict } = await import("../lib/street-section.ts");

const dir = join(import.meta.dirname, "fixtures");
let failed = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const fx = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const data = { roads: [], buildings: [] };
  fx.els.forEach(([kind, levels, ring], i) => {
    if (kind === "b") data.buildings.push({ id: i, ring, levels: levels ? Number(levels) : null, heightM: null });
    else if (kind !== "footway") data.roads.push({ line: ring, name: "" });
  });
  const m = measureSection(fx.center, data);
  const width = m ? m.widthM.toFixed(1) : "none";
  /*
   * עובר כשהמדידה קרובה לרוחב ה-GIS, או כשהיא מסמנת את עצמה "low" ולכן
   * לא תוצג כעובדה. נכשל רק מספר בטוח בעצמו ושגוי.
   */
  const near = m && Math.abs(m.widthM - fx.gisRowWidthM) / fx.gisRowWidthM <= 0.35;
  const ok = near ? m.confidence === "high" : !m || m.confidence === "low";
  if (!ok) failed++;
  console.log(`${file}: measured ${width} m (samples ${m?.validSamples}/${m?.totalSamples}, range ${m?.minWidthM.toFixed(1)}-${m?.maxWidthM.toFixed(1)}), confidence ${m?.confidence}, GIS row ${fx.gisRowWidthM} m ${ok ? "OK" : "FAIL"}`);
}
const r = parseRatioRange("1:1.2 עד 1:1.5");
if (!r || r[0] !== 1.2 || r[1] !== 1.5 || ratioVerdict(2, r) !== "wide" || parseRatioRange("משתנה") !== null) {
  failed++;
  console.log("ratio parsing FAIL");
}
process.exit(failed ? 1 : 0);
