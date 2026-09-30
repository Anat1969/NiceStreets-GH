// יוצר שבע ערכות צבע לפי סדר הקשת, ומאמת כל צירוף מול WCAG AA.
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const x = L(a), y = L(b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + 0.05) / (l + 0.05); };
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// גוון לכל צבע בקשת. צהוב וכתום דורשים בהירות נמוכה יותר כדי שלבן יעבור עליהם.
const HUES = [
  { key: "red",    label: "אדום",  h: 5,   accentL: 34, sat: 55 },
  { key: "orange", label: "כתום",  h: 26,  accentL: 30, sat: 65 },
  { key: "yellow", label: "צהוב",  h: 45,  accentL: 27, sat: 70 },
  { key: "green",  label: "ירוק",  h: 166, accentL: 28, sat: 56 },
  { key: "teal",   label: "תכלת",  h: 194, accentL: 28, sat: 60 },
  { key: "blue",   label: "כחול",  h: 218, accentL: 29, sat: 63 },
  { key: "violet", label: "סגול",  h: 275, accentL: 33, sat: 40 },
];

const WHITE = [255, 255, 255];
const out = [];
for (const c of HUES) {
  // מכהים את ההדגשה עד שלבן עליה עוברת 4.5, ומבהירים את הגוונים עד שהטקסט עובר.
  let accentL = c.accentL;
  let accent = hsl(c.h, c.sat, accentL);
  while (ratio(WHITE, accent) < 4.6 && accentL > 12) accent = hsl(c.h, c.sat, --accentL);

  const ink = hsl(c.h, 34, 13);
  const inkSoft = hsl(c.h, 22, 33);
  const paper = hsl(c.h, 42, 96);
  const surface = WHITE;
  const line = hsl(c.h, 22, 86);
  const accentSoft = hsl(c.h, 46, 92);

  /*
   * הגוון הבהיר ביותר חייב לעבור גם על לבן וגם על רקע ההדגשה הבהיר — שם
   * יושבים פאנל הסינון ותיבת "הידעת". הוא מוכהה עד ששניהם עוברים.
   */
  let faintL = 42;
  let inkFaint = hsl(c.h, 18, faintL);
  while ((ratio(inkFaint, WHITE) < 4.6 || ratio(inkFaint, accentSoft) < 4.6) && faintL > 22) {
    inkFaint = hsl(c.h, 18, --faintL);
  }

  const checks = {
    "לבן על הדגשה": ratio(WHITE, accent),
    "ink על נייר": ratio(ink, paper),
    "ink-soft על לבן": ratio(inkSoft, surface),
    "ink-faint על לבן": ratio(inkFaint, surface),
    "ink-faint על הדגשה בהירה": ratio(inkFaint, accentSoft),
    "הדגשה על לבן": ratio(accent, surface),
  };
  const min = Math.min(...Object.values(checks));
  out.push({
    ...c, min: +min.toFixed(2),
    css: {
      ink: hex(ink), inkSoft: hex(inkSoft), inkFaint: hex(inkFaint),
      paper: hex(paper), line: hex(line), accent: hex(accent), accentSoft: hex(accentSoft),
      b50: hex(hsl(c.h, 40, 95)), b100: hex(hsl(c.h, 40, 89)), b300: hex(hsl(c.h, 30, 66)),
      b500: hex(accent), b700: hex(hsl(c.h, c.sat, Math.max(10, accentL - 7))),
      b900: hex(hsl(c.h, c.sat, Math.max(6, accentL - 15))),
    },
  });
  console.log(c.label.padEnd(6), hex(accent), "מינימום", min.toFixed(2),
    min >= 4.5 ? "עובר" : "נכשל", Object.entries(checks).map(([k, v]) => `${k}=${v.toFixed(1)}`).join("  "));
}
console.log("\nמינימום כולל:", Math.min(...out.map((o) => o.min)).toFixed(2));
import("node:fs").then((fs) => fs.writeFileSync("rainbow.json", JSON.stringify(out, null, 1)));
