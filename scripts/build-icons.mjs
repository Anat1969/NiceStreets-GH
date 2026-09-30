/**
 * יוצר את אייקוני ה-PNG של ה-PWA מתוך app/icon.svg.
 *
 *   node scripts/build-icons.mjs
 *
 * דפדפנים ניידים דורשים PNG בגודל 192 ו-512 כדי להציע התקנה; SVG לבדו אינו
 * מספיק, ובלעדיהם הכפתור "הוספה למסך הבית" פשוט לא מופיע. להריץ מחדש אחרי
 * כל שינוי ב-app/icon.svg.
 */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const svg = readFileSync("/home/user/NiceStreets-GH/app/icon.svg", "utf8");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

for (const size of [192, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(
    `<html><body style="margin:0"><div style="width:${size}px;height:${size}px">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  );
  await p.screenshot({ path: `/home/user/NiceStreets-GH/public/icon-${size}.png`, omitBackground: false });
  await p.close();
}

// maskable: the same mark on a full-bleed field, with the safe area respected
const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
const inner = svg
  .replace(/<rect[^>]*\/>/, "")
  .replace("<svg ", '<svg width="320" height="320" ');
await p.setContent(
  `<html><body style="margin:0"><div style="width:512px;height:512px;background:#1f6f5c;display:flex;align-items:center;justify-content:center">${inner}</div></body></html>`,
);
await p.screenshot({ path: "/home/user/NiceStreets-GH/public/icon-maskable-512.png" });
await b.close();
console.log("done");
