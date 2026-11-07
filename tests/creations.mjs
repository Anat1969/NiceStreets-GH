// בדיקת דף הכתבות מול next start: כתבה A4 לכל נושא בלי גלישה, שלושה כפתורים באותו רוחב,
// כתובת ההעלאה לחדר במוזיאון, "יצירת כתבה" מהמאגר, ובלי גלילה אופקית ב-390.
// הרצה: npm run build && npx next start -p 4193 & node tests/creations.mjs
// SHOTS=<תיקייה> שומר צילום של כל כתבה ושל הדף ב-1440 וב-390.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Playwright מההתקנה הגלובלית (אינו תלות של האפליקציה)
const req = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const ORIGIN = process.env.ORIGIN || 'http://localhost:4193/';
const PAGE = ORIGIN + 'articles';
const JSON_URL = ORIGIN + 'creations.json';
const LAYOUT = 'magazine';
const CREATIONS_JS = process.env.CREATIONS_JS || path.join(__dirname, 'fixtures/creations.js');
const SHOTS = process.env.SHOTS;
const CR = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'creations.json'), 'utf8'));
const fails = [];
let passed = 0;
const ok = (c, msg) => { if (c) passed++; else { fails.push(msg); console.log('נכשל:', msg); } };

const mock = async (p) => {
  // הסביבה לא מגיעה ל-github.io ול-vercel.app: הרכיב המשותף מעותק מקומי, ותפריט הלוגו ריק עם shadow DOM (בלי זה React נכשל ב-hydration)
  await p.route('**/creations.js', (r) => r.fulfill({ path: CREATIONS_JS, contentType: 'application/javascript' }));
  await p.route('**/ai-menu.js', (r) => r.fulfill({ body: 'customElements.define("ai-menu", class extends HTMLElement { constructor() { super(); this.attachShadow({ mode: "open" }); } })', contentType: 'application/javascript' }));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ body: '', contentType: 'text/css' }));
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  ok(CR.topics.length >= 6 && new Set(CR.topics.map((t) => t.zone)).size === 3, `${CR.topics.length} נושאים בשלושת השלבים`);
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp });
    const m = await ctx.newPage();
    await mock(m);
    m.on('pageerror', (e) => errors.push(e.message));
    await m.goto(PAGE, { waitUntil: 'networkidle' });
    await m.locator('app-creations .ar-sheet').first().waitFor({ timeout: 15000 });
    ok(await m.locator('.app-nav a[aria-current="page"]').innerText() === 'כתבות', `(${vp.width}) "כתבות" מסומן בניווט`);
    await m.waitForFunction(() => [...document.querySelectorAll('.ar-grid .ar-sheet')].every((s) => s.dataset.fit), null, { timeout: 30000 });
    const sheets = await m.evaluate(() => [...document.querySelectorAll('.ar-grid .ar-sheet')].map((s) => ({ id: s.dataset.ar, fit: s.dataset.fit, layout: s.dataset.layout, dropped: s.dataset.dropped || '' })));
    ok(sheets.length === CR.topics.length, `(${vp.width}) ${sheets.length} כתבות`);
    ok(sheets.every((x) => x.fit !== 'over' && x.layout === LAYOUT), `(${vp.width}) ${LAYOUT}, בלי גלישה: ${sheets.map((x) => `${x.id}:${x.fit}${x.dropped ? '-' + x.dropped : ''}`).join(' ')}`);
    const acts = await m.locator('.ar-item').first().locator('.ar-acts > *').allInnerTexts();
    ok(acts.join('|') === 'הורדה והדפסה|העלאה לחדר במוזיאון|הגדלה', `(${vp.width}) שלושת הכפתורים: ${acts.join('|')}`);
    const widths = await m.locator('.ar-item').first().locator('.ar-acts > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    ok(Math.max(...widths) - Math.min(...widths) <= 1, `(${vp.width}) כפתורים באותו רוחב ${widths}`);
    const up = await m.locator('.ar-item').first().locator('.ar-acts a').getAttribute('href');
    ok(up.startsWith('https://taarucha.vercel.app/studio/import?article=1&src=') && up.includes(encodeURIComponent(JSON_URL)) && up.endsWith('&topic=' + CR.topics[0].id), `(${vp.width}) כתובת ההעלאה לחדר במוזיאון: ${up}`);
    ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `(${vp.width}) בלי גלילה אופקית`);
    ok(await m.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 2), `(${vp.width}) הדף נגלל רגיל`);
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await m.screenshot({ path: path.join(SHOTS, `page-${vp.width}.png`) });
      if (vp.width > 1000) {
        const n = await m.locator('.ar-grid .ar-sheet').count();
        for (let i = 0; i < n; i++) await m.locator('.ar-grid .ar-sheet').nth(i).screenshot({ path: path.join(SHOTS, `article-${String(i + 1).padStart(2, '0')}.png`) });
      }
    }
    // יצירת כתבה: הפאנל נפתח, בחירת מקור בונה כתבה, והכתובת למוזיאון היא pool
    const pick = CR.pool[Math.min(5, CR.pool.length - 1)];
    await m.click('[data-ar-new]');
    ok(await m.locator('.ar-comp').isVisible(), `(${vp.width}) "יצירת כתבה" נפתח בתוך הדף`);
    ok(await m.locator('.ar-src').count() === CR.pool.length, `(${vp.width}) ${CR.pool.length} מקורות במאגר`);
    await m.click(`[data-ar-src="pool:${pick.id}"]`);
    await m.waitForFunction(() => document.querySelector('.ar-comp-art .ar-sheet')?.dataset.fit, null, { timeout: 15000 });
    ok((await m.locator('.ar-comp-art .ar-sheet').getAttribute('data-fit')) !== 'over', `(${vp.width}) הכתבה מהמאגר בלי גלישה`);
    ok((await m.locator('.ar-comp-art .ar-acts a').getAttribute('href')).endsWith('&pool=' + encodeURIComponent(pick.id)), `(${vp.width}) העלאה למוזיאון עם pool`);
    if (SHOTS && vp.width > 1000) await m.locator('.ar-comp-art .ar-sheet').screenshot({ path: path.join(SHOTS, 'article-pool.png') });
    // כל מקורות המאגר נבנים בלי גלישה
    if (vp.width > 1000) {
      const over = [];
      for (const t of CR.pool) {
        await m.click(`[data-ar-src="pool:${t.id}"]`);
        await m.waitForFunction((id) => { const s = document.querySelector('.ar-comp-art .ar-sheet'); return s && s.dataset.ar === 'pool:' + id && s.dataset.fit; }, t.id, { timeout: 15000 }).catch(() => {});
        const f = await m.locator('.ar-comp-art .ar-sheet').getAttribute('data-fit');
        if (f === 'over') over.push(t.id);
      }
      ok(!over.length, `(${vp.width}) כל ${CR.pool.length} מקורות המאגר בלי גלישה ${over.join(' ')}`);
    }
    await m.click('[data-ar-rand]');
    ok(await m.locator('.ar-src.on').count() === 1, `(${vp.width}) "הפתעה" בוחר מקור`);
    ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `(${vp.width}) בלי גלילה אופקית אחרי יצירת כתבה`);
    await ctx.close();
  }
  // הקישור "כתבות" בדף המדריך
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const m = await ctx.newPage();
    await mock(m);
    m.on('pageerror', (e) => errors.push(e.message));
    await m.goto(ORIGIN, { waitUntil: 'networkidle' });
    const href = await m.locator('.app-nav a', { hasText: 'כתבות' }).first().getAttribute('href');
    ok(new URL(href, ORIGIN).href === PAGE, `קישור "כתבות" בניווט הראשי: ${href}`);
    await ctx.close();
  }
  ok(!errors.length, `בלי שגיאות בדף: ${errors.join(' | ')}`);
  await b.close();
  console.log(`כתבות: עברו ${passed}, נכשלו ${fails.length}`);
  process.exit(fails.length ? 1 : 0);
})();
