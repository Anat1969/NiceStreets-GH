// מפיק את public/creations.json מתוך lib/city.ts (תקן "יצירות" וכתבות, AppOfApp-GH/docs/creations-standard.md).
// הרצה: npx -y esbuild tools/creations.ts --bundle --platform=node --format=esm --log-level=warning | node --input-type=module
// כל טקסט, מספר ומקור נקראים מהקונפיגורציה של האפליקציה: שכבות וקריטריונים, דוגמאות (עם המקור ומספרי העמודים
// במסמך "הרחובות הטובים"), טיפולוגיות, שאלות ועקרונות. בקוד כתובים רק המסגור: שם הכתבה וההייקו (מסומן "הייקו מקורי").
// תמונות: "החדר העירוני" מדף הבית של האפליקציה, צילום מסך של הרכיב, כולו וכל שכבה מורמת (public/creations/img).
// צילומי הדוגמאות (public/examples) לא נכנסים: חלקם לכידות של Google Street View, ושימוש בהם ממתין לבדיקה משפטית (README).
import fs from "node:fs";
import {
  CITY,
  CRITERIA,
  CRITERIA_FAMILIES,
  EXAMPLE_MAP,
  FAMILY_MAP,
  LOCAL_QUESTION_KEYS,
  PRINCIPLES,
  QUESTION_MAP,
  QUESTIONS,
  STATUSES,
  TYPOLOGIES,
  TYPOLOGY_MAP,
  criteriaForQuestion,
} from "../lib/city";
import type { CriterionKey, FamilyKey } from "../lib/city";

type Zone = "ידע" | "הבנה" | "יישום";
type Creation = Record<string, unknown> & { style: string; title?: string };
type Topic = { id: string; zone: Zone; title: string; sub: string; creations: Creation[] };

const family = (k: FamilyKey) => FAMILY_MAP[k];
const criterion = (k: CriterionKey) => {
  const c = CRITERIA.find((x) => x.key === k);
  if (!c) throw new Error(`קריטריון לא נמצא: ${k}`);
  return c;
};
const example = (k: CriterionKey) => {
  const e = EXAMPLE_MAP[k];
  if (!e) throw new Error(`דוגמה לא נמצאה: ${k}`);
  return e;
};
const he = (place: string) => place.split(" — ")[0];
const quote = (k: CriterionKey): Creation => {
  const e = example(k);
  return { style: "quote", quote: e.text, who: he(e.place), cite: e.source };
};
const first = (s: string) => s.split(/(?<=\.)\s+/)[0];
const rest = (s: string) => s.split(/(?<=\.)\s+/).slice(1).join(" ");
const question = (s: string) => s.split("?")[0] + "?";
const img = (file: string, credit: string) => {
  if (!fs.existsSync(`public/creations/img/${file}`)) throw new Error(`חסרה תמונה: ${file}`);
  return { image: `creations/img/${file}`, credit, pos: "center 68%" };
};
const layerImg = (k: FamilyKey) => img(`room-${k}.jpg`, `החדר העירוני, שכבת ה${family(k).title}. מתוך דף הבית של האפליקציה`);
const haiku = (lines: string[], what: string): Creation => ({ style: "haiku", lines, text: `הייקו מקורי. ${what}` });
const T = (id: string, zone: Zone, title: string, sub: string, creations: Creation[]): Topic => ({
  id,
  zone,
  title,
  sub,
  creations: creations.map((c) => ({ id: c.style, kicker: `${CITY.appShortTitle} · ${zone}`, ...c })),
});
const names = (k: FamilyKey) => family(k).criteria.map((c) => c.name);

const topics: Topic[] = [];

// 1. ידע: ארבע השכבות
topics.push(
  T("four-layers", "ידע", "רחוב טוב בנוי מארבע שכבות", `${CRITERIA.length} קריטריונים בארבע שכבות: ${CRITERIA_FAMILIES.map((f) => f.title).join(", ")}.`, [
    { style: "poster", title: "החדר העירוני", text: CITY.tagline, ...img("room.jpg", "החדר העירוני, מתוך דף הבית של האפליקציה") },
    { style: "insight", title: "רחוב נמדד לרוב בתנועה, לא בהליכה", text: "מה שגורם לרצות ללכת ברגל, ==צל, חזית פעילה וצמתים קרובים==, לא נספר בספירת רכבים." },
    { style: "post", title: "ארבע שאלות על כל רחוב", text: CRITERIA_FAMILIES.map((f) => `${f.title}: ${question(f.text)}`).join("\n"), tags: ["הרחובות_הטובים", "אשדוד"] },
    { style: "fromto", title: "מספירת רכבים אל קול התושבים", fromLabel: "בעיה", toLabel: "פתרון", from: "רחוב נמדד לרוב בתנועה, לא בהליכה.", to: "מדידה עירונית וקול התושבים יחד.", text: `כל רחוב נבדק בנתוני העירייה וב-${QUESTIONS.length} שאלות שלכם, מול רחובות מאותו סוג.` },
    haiku(["רצפה של כורכר", "קירות, תקרה של עצים", "ופתח לעיר"], "הרחוב כ**חדר עירוני**: רצפה, קירות, תקרה ופתחים."),
  ]),
);

// 2. ידע: השלד
{
  const f = family("skeleton");
  topics.push(
    T("skeleton", "ידע", `${f.title}: האם מגיעים לרחוב`, f.text, [
      { style: "poster", title: example("intersection_density").title, text: first(criterion("intersection_density").text), ...layerImg("skeleton") },
      quote("intersection_density"),
      { style: "insight", title: "הרחוב האהוב הוא יעד בפני עצמו", text: `==${rest(criterion("place_and_movement").text)}==` },
      { style: "essay", title: `שלושה קריטריונים ב${f.title}`, text: names("skeleton").join(", "), body: f.criteria.map((c) => `**${c.name}.** ${c.text}`) },
      haiku(["צומת ועוד צומת", "עוד דרך להגיע", "עוד דלת פתוחה"], "צמתים קרובים הם **עוד דרכים להגיע**."),
    ]),
  );
}

// 3. הבנה: החתך
{
  const f = family("section");
  const r = TYPOLOGY_MAP.residential, b = TYPOLOGY_MAP.boulevard;
  topics.push(
    T("section", "הבנה", `${f.title}: צר עובד`, f.text, [
      { style: "poster", title: example("row_split").title, text: first(criterion("row_width").text), ...layerImg("section") },
      quote("proportions"),
      { style: "fromto", title: `מ${r.label} אל ${b.label}`, fromLabel: r.label, toLabel: b.label, from: `רוחב ${r.benchmarks.rowWidth}, יחס ${r.benchmarks.ratio}, מדרכה ${r.benchmarks.sidewalk}.`, to: `רוחב ${b.benchmarks.rowWidth}, יחס ${b.benchmarks.ratio}, מדרכה ${b.benchmarks.sidewalk}.`, text: "כל רחוב נמדד מול רחובות מאותו סוג." },
      { style: "insight", title: "למי שייך הרחוב: לרכב או לאדם", text: `==${rest(criterion("row_split").text)}==` },
      { style: "essay", title: `שלושה קריטריונים ב${f.title}`, text: names("section").join(", "), body: f.criteria.map((c) => `**${c.name}.** ${c.text}`) },
    ]),
  );
}

// 4. הבנה: הדופן
{
  const f = family("frontage");
  const c = TYPOLOGY_MAP.main_commercial, r = TYPOLOGY_MAP.residential;
  topics.push(
    T("frontage", "הבנה", `${f.title}: המטר הראשון מהמדרכה`, f.text, [
      { style: "poster", title: example("transparency").title, text: first(criterion("transparency").text), ...layerImg("frontage") },
      quote("plot_street_meeting"),
      { style: "fromto", title: "שתי דרכים לפגוש את הרחוב", fromLabel: c.label, toLabel: r.label, from: `חזית ${c.benchmarks.frontage}.`, to: `${r.benchmarks.frontage}.`, text: first(criterion("plot_street_meeting").text) },
      { style: "insight", title: example("building_rhythm").title, text: `==${first(criterion("building_rhythm").text)}==` },
      { style: "essay", title: `ארבעה קריטריונים ב${f.title}`, text: names("frontage").join(", "), body: f.criteria.map((x) => `**${x.name}.** ${first(x.text)}`) },
      haiku(["חלון ראווה", "דלת, ועוד חלון", "הצעד מאט"], "חזית עשירה בפרטים **מאטה את ההליכה**."),
    ]),
  );
}

// 5. יישום: מרקם ואקלים
{
  const f = family("texture");
  topics.push(
    T("texture", "יישום", "באקלים שלנו, הצל הוא תנאי", f.text, [
      { style: "poster", title: example("tree_canopy").title, text: he(example("tree_canopy").place), ...layerImg("texture") },
      quote("tree_canopy"),
      { style: "insight", title: "הצל הוא תנאי להליכה, לא קישוט", text: `==${rest(criterion("tree_canopy").text)}==` },
      { style: "post", title: "כמה חופת עצים לכל סוג רחוב", text: TYPOLOGIES.slice(0, 6).map((t) => `${t.label}: ${t.benchmarks.canopy}`).join("\n"), tags: ["הרחובות_הטובים", "צל", "אשדוד"] },
      haiku(["צהרי אוגוסט", "שדרה של עצים", "ועוד צעד בצל"], "באקלים הישראלי **הצל הוא תנאי להליכה**."),
    ]),
  );
}

// 6. יישום: מה שהמסמך לא מודד, והתושבים כן
{
  const local = LOCAL_QUESTION_KEYS.map((k) => QUESTION_MAP[k]);
  topics.push(
    T("local", "יישום", "שלוש שאלות שהעירייה יכולה לשפר מהר", "מה שהמסמך אינו מודד, והאפליקציה שואלת את התושבים: שהייה, תחזוקה וביטחון.", [
      { style: "gradient", title: "הקול שלכם הופך לסטטוס גלוי", text: "לכל רחוב שקיבל קולות יש **סטטוס עירוני**, שמתעדכן במפה ובכרטיס הרחוב." },
      { style: "post", title: "מה שואלים על כל רחוב", text: local.map((q) => `${q.label}: ${q.help}`).join("\n"), tags: ["הרחובות_הטובים", "אשדוד"] },
      { style: "fromto", title: "מקול של תושב אל פעולה", fromLabel: STATUSES[0].label, toLabel: STATUSES[1].label, from: STATUSES[0].meaning, to: STATUSES[1].meaning, text: PRINCIPLES.find((p) => p.key === "implementation")!.text },
      { style: "insight", title: CITY.homeQuestion, text: "==הקול שלכם הופך לסטטוס גלוי==." },
      haiku(["ספסל בצל", "פנס דולק בערב", "ומדרכה שלמה"], "שלוש השאלות שהעירייה **יכולה לשפר מהר**."),
    ]),
  );
}

// 7. יישום: שש טיפולוגיות
{
  const u = PRINCIPLES.find((p) => p.key === "understanding")!;
  topics.push(
    T("typologies", "הבנה", "שדרה מול שדרה, מגורים מול מגורים", u.text, [
      { style: "veil", title: `${TYPOLOGIES.length} סוגי רחוב`, text: u.text, ...img("room-section.jpg", "החדר העירוני, שכבת החתך. מתוך דף הבית של האפליקציה") },
      { style: "post", title: "רוחב זכות הדרך לפי סוג", text: TYPOLOGIES.map((t) => `${t.label}: ${t.benchmarks.rowWidth}`).join("\n"), tags: ["הרחובות_הטובים", "טיפולוגיות"] },
      { style: "insight", title: "כל רחוב נמדד מול רחובות מאותו סוג", text: `==${TYPOLOGY_MAP.pedestrian_mall.label}: מדרכה ${TYPOLOGY_MAP.pedestrian_mall.benchmarks.sidewalk}==, ${TYPOLOGY_MAP.boulevard.label}: ${TYPOLOGY_MAP.boulevard.benchmarks.sidewalk}.` },
      { style: "fromto", title: "מציר מסחר שכונתי אל ציר ראשי", fromLabel: TYPOLOGY_MAP.neighborhood_commercial.label, toLabel: TYPOLOGY_MAP.main_commercial.label, from: TYPOLOGY_MAP.neighborhood_commercial.description, to: TYPOLOGY_MAP.main_commercial.description, text: `חופת עצים: ${TYPOLOGY_MAP.neighborhood_commercial.benchmarks.canopy} מול ${TYPOLOGY_MAP.main_commercial.benchmarks.canopy}.` },
    ]),
  );
}

// המאגר: כל קריטריון (עם הדוגמה והמקור שלו), כל סוג רחוב וכל שאלה לתושבים
const zoneOfFamily: Record<FamilyKey, Zone> = { skeleton: "ידע", section: "הבנה", frontage: "הבנה", texture: "יישום" };
const pool: Topic[] = [
  ...CRITERIA.map((c) => {
    const f = family(c.familyKey);
    const e = EXAMPLE_MAP[c.key];
    const cs: Creation[] = [
      { style: "poster", title: c.name, text: first(c.text), ...layerImg(c.familyKey) },
      { style: "insight", title: first(c.text).replace(/\.$/, ""), text: `==${rest(c.text) || c.text}==` },
      { style: "gradient", title: `${f.title}: ${question(f.text)}`, text: `ב${f.title}: ${names(c.familyKey).join(", ")}.` },
    ];
    if (e) cs.splice(1, 0, quote(c.key), { style: "post", title: e.title, text: [he(e.place), ...e.text.split(/(?<=\.)\s+/)].join("\n"), tags: ["הרחובות_הטובים"] });
    else cs.push({ style: "post", title: c.name, text: c.text.split(/(?<=\.)\s+/).join("\n"), tags: ["הרחובות_הטובים"] });
    return T(`criterion-${c.key}`, zoneOfFamily[c.familyKey], c.name, `${f.title} · ${f.text}`, cs);
  }),
  ...TYPOLOGIES.map((t) =>
    T(`type-${t.key}`, "הבנה", t.label, t.description, [
      { style: "gradient", title: t.label, text: t.description },
      { style: "post", title: `${t.label} במספרים`, text: [`רוחב זכות הדרך: ${t.benchmarks.rowWidth}`, `מדרכה: ${t.benchmarks.sidewalk}`, `יחס גובה לרוחב: ${t.benchmarks.ratio}`, `חזית: ${t.benchmarks.frontage}`, `חופת עצים: ${t.benchmarks.canopy}`, `מרחק בין צמתים: ${t.benchmarks.intersections}`].join("\n"), tags: ["הרחובות_הטובים", "טיפולוגיות"] },
      { style: "insight", title: `רוחב ${t.benchmarks.rowWidth}, חופה ${t.benchmarks.canopy}`, text: `==${t.benchmarks.buildings} בניינים לכל 100 מ' דופן.==` },
      { style: "veil", title: t.label, text: t.description, ...img("room.jpg", "החדר העירוני, מתוך דף הבית של האפליקציה") },
    ]),
  ),
  ...QUESTIONS.map((q) => {
    const cs = criteriaForQuestion(q.key);
    const fk = cs[0]?.familyKey ?? "texture";
    return T(`question-${q.key}`, "יישום", `שאלה לתושבים: ${q.label}`, q.help, [
      { style: "poster", title: q.label, text: q.help, ...layerImg(fk) },
      { style: "insight", title: q.help, text: cs.length ? `==נמדד גם ב${cs.map((c) => c.name).join(", ")}.==` : "==המסמך אינו מודד את זה, והעירייה יכולה לשפר מהר.==" },
      { style: "gradient", title: q.label, text: q.alsoCovers.length ? `השאלה מכסה גם: ${q.alsoCovers.join(", ")}.` : CITY.homeQuestion },
      { style: "post", title: `${q.label}: מה שואלים`, text: [q.help, ...cs.map((c) => `${c.name}: ${first(c.text)}`)].join("\n"), tags: ["הרחובות_הטובים", "אשדוד"] },
    ]);
  }),
];

const out = {
  app: {
    id: "nicestreets",
    name: CITY.appTitle,
    url: "https://nicestreets-vercal.vercel.app",
    repo: "Anat1969/NiceStreets-GH",
    description: `${CITY.tagline}. ${CRITERIA.length} קריטריונים לרחוב טוב בארבע שכבות, דוגמאות מהארץ, וקול התושבים. ${CITY.authority}.`,
    palette: { a: "#1f6f5c", b: "#862f27", c: "#c9a36a", s: "#3f7f4f", accent: "#1f6f5c", marker: "#fde68a", paper: "#ffffff", paper2: "#efe6d4", ink: "#16202b", "b-wash": "#f4e3e1", "s-wash": "#e4efea" },
    article: { layout: "magazine" },
  },
  topics,
  pool,
};

// יחס כמו 1:1.5 ושבר מתהפכים בשורה עברית. בידוד כיווניות (LRI…PDI) שומר על הסדר בלי לשנות את הטקסט
const isolate = (x: unknown): unknown =>
  typeof x === "string"
    ? x.replace(/(?<![⁦\w./:])(\d+(?:\.\d+)?[/:]\d+(?:\.\d+)?)(?![\w/:])/g, "⁦$1⁩")
    : Array.isArray(x)
      ? x.map(isolate)
      : x && typeof x === "object"
        ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, k === "image" ? y : isolate(y)]))
        : x;
out.topics = isolate(out.topics) as Topic[];
out.pool = isolate(out.pool) as Topic[];

// בדיקות התקן
const fail: string[] = [];
const words = (s: unknown) => String(s).replace(/[*=]/g, "").trim().split(/\s+/).length;
if (topics.length < 6) fail.push("פחות מ-6 נושאים");
if (new Set(topics.map((t) => t.zone)).size < 3) fail.push("חסר שלב");
for (const t of [...out.topics, ...out.pool]) {
  if (t.creations.length < 4 || t.creations.length > 6) fail.push(`${t.id}: ${t.creations.length} יצירות`);
  const st = t.creations.map((c) => c.style);
  if (new Set(st).size !== st.length) fail.push(`${t.id}: עיצוב חוזר`);
  if (words(t.title) > 8) fail.push(`${t.id}: כותרת ארוכה`);
}
for (const t of out.topics) for (const c of t.creations) if (c.title && words(c.title) > 8) fail.push(`${t.id}/${c.style}: כותרת ארוכה "${c.title}"`);
if (out.pool.length < 20) fail.push(`מאגר קטן: ${out.pool.length}`);
if (fail.length) {
  console.error(fail.join("\n"));
  process.exit(1);
}
fs.writeFileSync("public/creations.json", JSON.stringify(out, null, 1) + "\n");
console.log(`creations.json: ${topics.length} נושאים, ${topics.reduce((n, t) => n + t.creations.length, 0)} יצירות, ${pool.length} במאגר`);
