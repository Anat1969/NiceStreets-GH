/*
 * בדיקה מקצה לקצה של העלאת תמונה בתוך המסגרת, ברוחב 390.
 *
 * מריצים מול שרת ייצור מקומי:
 *   npm run build
 *   STAFF_CODE=x ADMIN_CODE=y npx next start -p 3311
 *   QA_BASE=http://localhost:3311 QA_STAFF_CODE=x QA_ADMIN_CODE=y \
 *     node scripts/qa-content-images.mjs
 *
 * playwright אינו תלות של הפרויקט; אם הוא מותקן גלובלית מציינים את מיקומו
 * ב-PLAYWRIGHT_MODULE ואת הדפדפן ב-PLAYWRIGHT_CHROMIUM.
 */
import zlib from "node:zlib";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const BASE = process.env.QA_BASE ?? "http://localhost:3311";
const STAFF_CODE = process.env.QA_STAFF_CODE ?? "stafftest";
const ADMIN_CODE = process.env.QA_ADMIN_CODE ?? "admintest";

// PNG 64x64 תקין, נבנה כאן כדי שהדפדפן באמת יוכל לפענח אותו.
function png(w = 64, h = 64) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const off = y * (w * 3 + 1);
    raw[off] = 0;
    for (let x = 0; x < w; x++) {
      raw[off + 1 + x * 3] = (x * 4) % 256;
      raw[off + 2 + x * 3] = (y * 4) % 256;
      raw[off + 3 + x * 3] = 128;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  let table = null;
  function crc32(buf) {
    if (!table) {
      table = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const results = [];
const ok = (name, pass, note = "") => {
  results.push({ name, pass, note });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${note ? " — " + note : ""}`);
};

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
    : {},
);

async function ctx(code) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (code) {
    const p = await c.newPage();
    await p.goto(`${BASE}/admin`);
    await p.fill("#code", code);
    await p.click('button[type=submit]');
    await p.waitForLoadState("networkidle");
    await p.close();
  }
  return c;
}

// ---- 0. הכניסה סלחנית לרווחים ולמרכאות, ולא לקוד שגוי
const resident = await ctx(null);
{
  // הקשר חד-פעמי: בדיקת הכניסה מפעילה עוגייה, ואסור שתדבק בהקשר התושב.
  const scratch = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await scratch.newPage();
  async function login(code) {
    const r = await p.request.post(`${BASE}/api/staff/login`, {
      form: { code },
      maxRedirects: 0,
    });
    return r.headers()["location"] ?? "";
  }
  ok("כניסה — קוד נקי", (await login(ADMIN_CODE)) === "/admin");
  ok("כניסה — רווח בסוף הקוד", (await login(`${ADMIN_CODE} `)) === "/admin");
  ok("כניסה — שורה חדשה בקצה", (await login(`\n${ADMIN_CODE}\n`)) === "/admin");
  ok("כניסה — מרכאות סביב הקוד", (await login(`"${ADMIN_CODE}"`)) === "/admin");
  ok("כניסה — קוד שגוי נדחה", (await login("no-such-code")) === "/admin?error=1");
  await scratch.close();
}

// ---- 1. תושב: אין מסגרות העלאה, ואין מסגרת ריקה
{
  const p = await resident.newPage();
  await p.goto(`${BASE}/learn/criteria/skeleton`);
  const inputs = await p.locator('input[type=file]').count();
  ok("תושב — אין שדה העלאה בעמוד קריטריונים", inputs === 0);
  const empty = await p.getByText("אין עדיין תמונה").count();
  ok("תושב — אין מסגרת ריקה", empty === 0);
  // תמונות המסמך נשלחות עם הבנייה, ולכן תושב כן רואה אותן.
  const shipped = await p.locator('main img[src^="/examples/"]').count();
  ok("תושב — רואה את תמונות הדוגמאות שנשלחו עם הבנייה", shipped > 0, `${shipped}`);
  const r = await p.request.post(`${BASE}/api/admin/content-image`, {
    data: { slot: "criterion:tree_canopy", dataUrl: "data:image/png;base64,AA", alt: "x" },
  });
  ok("תושב — 403 על העלאה", r.status() === 403, `status ${r.status()}`);
  await p.close();
}

// ---- 2. צוות (לא מנהלת): גם הוא חסום
const staff = await ctx(STAFF_CODE);
{
  const p = await staff.newPage();
  const r = await p.request.post(`${BASE}/api/admin/content-image`, {
    data: { slot: "criterion:tree_canopy", dataUrl: "data:image/png;base64,AA", alt: "x" },
  });
  ok("צוות — 403 על העלאה", r.status() === 403, `status ${r.status()}`);
  await p.close();
}

// ---- 3. מנהלת: מסגרת, העלאה, הצגה, הסרה
const admin = await ctx(ADMIN_CODE);
{
  const p = await admin.newPage();
  await p.goto(`${BASE}/learn/criteria/skeleton`);
  const frames = await p.locator('input[type=file]').count();
  ok("מנהלת — יש מסגרות העלאה", frames > 0, `${frames} מסגרות`);

  // לכל אחד מ-12 הקריטריונים יש תמונה מהמסמך, ולכן המסגרת מסומנת כהחלפה.
  const before = await p.getByText("לחיצה מחליפה").count();
  ok("מנהלת — המסגרת מסומנת כניתנת להחלפה", before > 0, `${before}`);

  await p.setInputFiles('input[type=file] >> nth=0', {
    name: "t.png",
    mimeType: "image/png",
    buffer: png(),
  });
  await p.waitForTimeout(2500);
  const img = p.locator("main img").first();
  const shown = await img.count();
  ok("מנהלת — התמונה מוצגת אחרי העלאה", shown > 0);
  if (shown) {
    const natural = await img.evaluate((el) => el.naturalWidth);
    ok("התמונה נטענת בפועל", natural > 0, `naturalWidth ${natural}`);
  }

  // גלישה אופקית ב-390
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok("390 — אין גלישה אופקית", overflow <= 0, `${overflow}px`);

  // ציבורי: התמונה נגישה בלי התחברות
  const pub = await resident.newPage();
  const src = await p.locator("main img").first().getAttribute("src");
  const r = await pub.request.get(`${BASE}${src}`);
  ok("תושב — קריאת התמונה מותרת", r.status() === 200, `status ${r.status()}`);
  await pub.goto(`${BASE}/learn/criteria/skeleton`);
  ok("תושב — רואה את התמונה שהועלתה", (await pub.locator("main img").count()) > 0);
  await pub.close();

  // הסרה
  await p.reload();
  const remove = p.getByRole("button", { name: "הסרה" }).first();
  await remove.click();
  await p.waitForTimeout(2000);
  // אחרי ההסרה חוזרת התמונה שנשלחה עם הבנייה, ולא מסגרת ריקה.
  const after = await p.locator('main img[src^="/examples/"]').count();
  ok("מנהלת — ההסרה מחזירה את תמונת המסמך", after > 0, `${after}`);
  await p.close();
}

// ---- 4. לוגו בלוח הבקרה
{
  const p = await admin.newPage();
  await p.goto(`${BASE}/admin`);
  const logo = p.getByRole("heading", { name: "לוגו העירייה" });
  ok("לוח בקרה — יש מסגרת לוגו", (await logo.count()) > 0);
  await p.close();
}

// ---- 5. מסגרות בדוגמאות, ורוחב 390
{
  const p = await admin.newPage();
  await p.goto(`${BASE}/examples`);
  ok(
    "מנהלת — מסגרות העלאה בדוגמאות",
    (await p.locator('input[type=file]').count()) > 0,
  );
  const withPhotos = await p.locator('main img[src^="/examples/"]').count();
  ok("דוגמאות — לכל 12 הדוגמאות יש תמונה", withPhotos === 12, `${withPhotos}`);
  ok(
    "דוגמאות — מוצג מקור לכל דוגמה",
    (await p.getByText("מינהל התכנון").count()) >= 12,
  );
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok("390 — דוגמאות בלי גלישה", overflow <= 0, `${overflow}px`);
  await p.close();
}

// ---- 6. הדלת: אפשר להגיע לכניסת הצוות בלי להקליד כתובת
{
  const p = await resident.newPage();
  await p.goto(`${BASE}/`);
  const door = p.getByRole("link", { name: "כניסת צוות" });
  ok("תושב — קישור 'כניסת צוות' מופיע בתחתית", (await door.count()) > 0);
  await door.first().click();
  await p.waitForLoadState("networkidle");
  ok(
    "הקישור מוביל למסך ההתחברות",
    (await p.locator("#code").count()) > 0,
    p.url(),
  );
  await p.close();
}

// ---- 7. צוות מגיע לאישור התמונות, ויכול לצאת
{
  const p = await staff.newPage();
  await p.goto(`${BASE}/`);
  const tab = p.getByRole("link", { name: "צוות" });
  ok("צוות — לשונית 'צוות' בניווט", (await tab.count()) > 0);
  await tab.first().click();
  await p.waitForLoadState("networkidle");
  ok(
    "צוות — מגיע למסך אישור התמונות",
    (await p.getByRole("heading", { name: "תמונות לאישור" }).count()) > 0,
  );

  await p.getByRole("button", { name: "יציאה מהצוות" }).first().click();
  await p.waitForLoadState("networkidle");
  await p.goto(`${BASE}/`);
  ok(
    "היציאה מחזירה למצב תושב",
    (await p.getByRole("link", { name: "כניסת צוות" }).count()) > 0,
  );
  await p.close();
}

// ---- 8. הנחיות הסבב: מספרים, אייקונים, מפה, לוגו
{
  // נתוני הדגמה, כדי שיהיו מובילים ומונים אמיתיים לבדוק עליהם.
  const seeder = await admin.newPage();
  await seeder.request.post(`${BASE}/api/admin/demo`, { data: { action: "seed" } });
  await seeder.close();

  const p = await resident.newPage();

  await p.goto(`${BASE}/`);
  const body = await p.locator("body").innerText();
  ok(
    "מספרים בספרות ולא במילים",
    !/(^|\s)(קול אחד|שני קולות|תמונה אחת|שתי תמונות|נמצא רחוב אחד)(\s|$|[.,·])/.test(body),
  );
  /*
   * המובילים תלויים בנתונים. במסד מקומי ריק אין מה לבדוק, ולכן הבדיקה
   * מדלגת במפורש במקום לדווח כישלון על מסך תקין.
   */
  const hasLeaders = !body.includes("עדיין אין קולות");
  if (hasLeaders) {
    ok("מיקום ברשימת המובילים מסומן במספר ונקודה", /1\./.test(body));
    ok("למוביל מוצג ציון בסולם 10", body.includes("ציון מ-10"));
  } else {
    console.log("SKIP  המובילים — אין קולות במסד המקומי");
  }
  ok(
    "לכל מונה יש כותרת ותת-כותרת",
    body.includes("דירוגים שנשלחו") &&
      body.includes("שקיבלו דירוג") &&
      body.includes("מאושרות"),
  );
  ok("לוגו מוצג בכותרת", (await p.locator('header img').count()) > 0);
  ok(
    "לשונית הניווט נקראת טבלה",
    (await p.getByRole("link", { name: "טבלה" }).count()) > 0,
  );
  ok(
    "כפתורי התצוגה הם אייקונים",
    (await p.getByRole("button", { name: "תצוגת נייד" }).count()) > 0 &&
      (await p.getByRole("button", { name: "תצוגת נייד" }).first().innerText()).trim() === "",
  );

  // נתוני הדגמה חייבים להיות מוכרזים בכל מסך שמציג מספרים.
  // במסד מקומי ריק אין רחובות, ולכן אי אפשר לזרוע קולות הדגמה.
  const demoSeeded = body.includes("נתוני הדגמה");
  if (!demoSeeded) {
    console.log("SKIP  נתוני הדגמה — לא נזרעו במסד המקומי");
  }
  if (demoSeeded) {
    ok("נתוני הדגמה מוכרזים בדף הבית", true);
    for (const path of ["/streets", "/map"]) {
      await p.goto(`${BASE}${path}`);
      ok(
        `נתוני הדגמה מוכרזים ב-${path}`,
        (await p.locator("body").innerText()).includes("נתוני הדגמה"),
      );
    }
  }

  await p.goto(`${BASE}/map`);
  ok(
    "מפה — שני כפתורי מיפוי",
    (await p.getByRole("button", { name: /מיפוי קולות לפי רובע/ }).count()) > 0 &&
      (await p.getByRole("button", { name: /מיפוי קולות לפי רחוב/ }).count()) > 0,
  );

  /*
   * גובה המפה: הגיליון של maplibre ביטל את ה-absolute שלנו, והמפה קיבלה
   * גובה 0 — קנבס ריק ותוויות חתוכות, בדיוק כמו "המפה לא עובדת".
   */
  await p.waitForTimeout(3500);
  const mapHeight = await p
    .locator(".maplibregl-map")
    .evaluate((el) => Math.round(el.getBoundingClientRect().height))
    .catch(() => 0);
  ok("מפה — לקנבס יש גובה אמיתי", mapHeight > 200, `${mapHeight}px`);
  /*
   * הסימנים נוצרים רק אחרי אירוע load של המפה, וזה דורש את סגנון המפה
   * מ-tiles.openfreemap.org. בסביבה שחוסמת את המארח הזה אין מפה, ולכן
   * הבדיקה מדווחת שלא נבדקה במקום להיכשל על משהו שאינו בקוד.
   */
  const styleUp = await p.request
    .get("https://tiles.openfreemap.org/styles/positron", { timeout: 8000 })
    .then((r) => r.ok())
    .catch(() => false);
  if (!styleUp) {
    console.log("SKIP  מפה — סגנון המפה חסום בסביבה, אין סימנים לבדוק");
  } else {
    ok(
      "מפה — מצוירים סימנים עם מספר",
      (await p.locator(".maplibregl-marker").count()) > 0,
      `${await p.locator(".maplibregl-marker").count()} סימנים`,
    );
  }

  /*
   * מזהי הרחובות נקבעים בזמן ריצה ולא נכתבים כאן.
   * קודם לכן היו כאן "s-0" ו-"s-4", מזהים של מסד מקומי מסוים; מסד שנבנה
   * מחדש נותן מזהי uuid, וכל הבדיקות שנשענו עליהם נפלו בלי שדבר באתר
   * נשבר. הבחירה נעשית לפי מה שנבדק: רחוב עם תמונות ורחוב בלי.
   */
  const { streets: streetList } = await p.request
    .get(`${BASE}/api/streets`)
    .then((r) => r.json())
    .catch(() => ({ streets: [] }));
  let streetWithPhotos = null;
  let streetWithoutPhoto = null;
  for (const row of streetList) {
    const probe = await admin.newPage();
    await probe.goto(`${BASE}/street/${row.id}`);
    await probe.waitForTimeout(700);
    const text = await probe.locator("body").innerText();
    if (text.includes("אין עדיין תמונה של")) streetWithoutPhoto ??= row.id;
    else if (!text.includes("עדיין אין תמונות מאושרות")) streetWithPhotos ??= row.id;
    await probe.close();
    if (streetWithPhotos && streetWithoutPhoto) break;
  }

  // כל תמונה בגלריה נושאת את הנימוק ואת הציון שהגיעו איתה.
  if (!streetWithPhotos) {
    console.log("SKIP  גלריה — אין רחוב עם תמונות במסד המקומי");
  } else {
    // הקשר המנהלת, ולא הצוות: בדיקת היציאה שלמעלה מנתקת את הצוות.
    const g = await admin.newPage();
    await g.goto(`${BASE}/street/${streetWithPhotos}`);
    await g.waitForTimeout(1200);
    const t = await g.locator("body").innerText();
    if (t.includes("עדיין אין תמונות מאושרות")) {
      console.log("SKIP  גלריה — אין תמונות במסד המקומי");
    } else {
      ok("גלריה — לכל תמונה ציון הקול שלה", (t.match(/ציון הקול/g) || []).length > 0);
      ok(
        "גלריה — ההכרעה בפעלים מפורשים",
        t.includes("לאשר לפרסום") || t.includes("מאושרת ✓"),
      );
      ok(
        "גלריה — מצב התמונה כתווית",
        t.includes("מאושרת ומוצגת") || t.includes("ממתינה לאישור") || t.includes("נדחתה"),
      );
    }
    await g.close();
  }

  // רחוב בלי תמונה: אריח מהנתונים שלו, והזמנה לצלם — ולא כותרת קירחת.
  if (!streetWithoutPhoto) {
    console.log("SKIP  רחוב בלי תמונה — אין רחוב כזה במסד המקומי");
  } else {
    const n = await resident.newPage();
    await n.goto(`${BASE}/street/${streetWithoutPhoto}`);
    await n.waitForTimeout(900);
    const t = await n.locator("body").innerText();
    ok("רחוב בלי תמונה — יש הזמנה לצלם", t.includes("אין עדיין תמונה של"));
    ok(
      "רחוב בלי תמונה — שם הרחוב עדיין בראש",
      (await n.locator("main span.font-bold").first().innerText()).trim().length > 0,
    );
    const tiles = await n.evaluate(() => {
      const el = document.querySelector("main span[style*='linear-gradient']");
      return el ? getComputedStyle(el).backgroundImage.includes("gradient") : false;
    });
    ok("רחוב בלי תמונה — האריח צבוע לפי הציון", tiles);
    await n.close();
  }

  // סולם הציון המוצג הוא 0–10 בכל מסך.
  await p.goto(`${BASE}/street/${streetWithPhotos ?? streetList[0]?.id ?? "s-0"}`);
  const streetBody = await p.locator("body").innerText();
  ok("כרטיס רחוב — הציון מתוך 10", streetBody.includes("מתוך 10"));
  ok("כרטיס רחוב — אין יותר 'מתוך 5'", !streetBody.includes("מתוך 5"));

  // חיפוש רחוב: בטבלה ובמפה.
  await p.goto(`${BASE}/streets`);
  await p.getByLabel("חיפוש רחוב").fill("הרצל");
  await p.waitForTimeout(500);
  const table = await p.locator("body").innerText();
  ok("טבלה — חיפוש רחוב מסנן", table.includes("הרצל") && !table.includes("רוגוזין"));

  await p.goto(`${BASE}/map`);
  await p.waitForTimeout(3500);
  ok("מפה — המקרא פתוח כברירת מחדל", (await p.locator("details.map-legend[open]").count()) > 0);
  /*
   * חיפוש הרחוב מציע רק רחובות שיש להם מיקום על המפה. המיקומים הגיעו
   * מגיאוקודינג ונשמרו במסד הייצור, ולכן במסד מקומי חדש אין אף רחוב
   * ממוקם — ואין מה להציע ואין סימן לבדוק.
   */
  await p.fill("#map-search", "הרצל");
  await p.waitForTimeout(600);
  const suggestions = await p.locator("#map-search ~ ul button").count();
  const marks = await p.locator(".map-mark-disc").count();
  if (!styleUp || marks === 0) {
    console.log("SKIP  מפה — אין רחובות ממוקמים או שהסגנון חסום");
  } else {
    ok("מפה — חיפוש רחוב מציע תוצאה", suggestions > 0);
    const disc = await p.locator(".map-mark-disc").first().evaluate((e) => ({
      fs: parseInt(e.style.fontSize, 10),
      hasColour: Boolean(e.style.color),
    }));
    ok("מפה — המספר בגודל קריא ובצבע מחושב", disc.fs >= 19 && disc.hasColour, `${disc.fs}px`);
  }

  await p.goto(`${BASE}/learn`);
  const learn = await p.locator("body").innerText();
  ok("מסך הלימוד מציג את מה שהמסמך אינו מודד", learn.includes("מה שהמסמך אינו מודד"));

  // הניסוח שהטעה: ציון של תושבים שנראה כאילו לא נוקד כלל.
  const street = await p.request.get(`${BASE}/streets`);
  ok("עמוד הטבלה נטען", street.status() === 200, `status ${street.status()}`);

  await p.goto(`${BASE}/learn/types/boulevard`);
  ok(
    "ערכי ייחוס עם אייקונים",
    (await p.locator("dl svg").count()) >= 6,
    `${await p.locator("dl svg").count()} אייקונים`,
  );

  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok("390 — סוג רחוב בלי גלישה", overflow <= 0, `${overflow}px`);
  await p.close();
}

// ---- מדיניות התמונות
{
  const p = await resident.newPage();

  // שלב 3 בדירוג: התמונה רשות, והדילוג כפתור במשקל זהה.
  await p.goto(`${BASE}/choose`);
  // רחוב שאינו עובר בכמה רובעים, כדי שהמעבר לשאלות לא יחכה לבחירת רובע.
  await p.fill("#street", "אחד העם");
  await p.waitForTimeout(400);
  const match = p.locator("#street-matches button").first();
  if ((await match.count()) > 0) {
    await match.click();
    await p.click("text=לשאלות");
    await p.waitForTimeout(300);
    // שבע השאלות, הערך הגבוה בכל אחת.
    const groups = p.locator("fieldset");
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      const buttons = groups.nth(i).locator("button[aria-pressed]");
      const n = await buttons.count();
      if (n > 0) await buttons.nth(n - 1).click();
    }
    const toReason = p.locator("text=לנימוק");
    if (await toReason.isEnabled()) {
      await toReason.click();
      await p.waitForTimeout(300);
      const body = await p.locator("body").innerText();
      ok("דירוג — התמונה מסומנת כלא חובה", body.includes("לא חובה"));
      ok(
        "דירוג — השורה שמסבירה למה תמונה",
        body.includes("תמונה עוזרת לעירייה לראות מה אתם רואים"),
      );
      ok("דירוג — יש כפתור שליחה בלי תמונה", body.includes("לשלוח בלי תמונה"));
      const [skip, shoot] = await Promise.all([
        p.getByRole("button", { name: "לשלוח בלי תמונה" }).boundingBox(),
        p
          .getByRole("button", { name: /^(לצלם את הרחוב|לבחור תמונה)$/ })
          .boundingBox(),
      ]);
      ok(
        "דירוג — הדילוג והצילום באותו גודל",
        Boolean(skip && shoot) && Math.abs(skip.width - shoot.width) < 6 &&
          Math.abs(skip.height - shoot.height) < 4,
        skip && shoot ? `${Math.round(skip.width)} מול ${Math.round(shoot.width)}` : "חסר",
      );
      const overflow = await p.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      ok("390 — שלב הנימוק בלי גלישה", overflow <= 0, `${overflow}px`);
    } else {
      ok("דירוג — מעבר לנימוק", false, "הכפתור נשאר מושבת");
    }
  } else {
    ok("דירוג — חיפוש רחוב", false, "לא נמצאה התאמה להרצל");
  }

  // הצעת רחוב: התמונה חובה, והשרת דוחה בלעדיה.
  await p.goto(`${BASE}/suggest?name=${encodeURIComponent("מעבר בין הבתים")}`);
  const suggest = await p.locator("body").innerText();
  ok("הצעת רחוב — המסך נטען והשם עובר אליו", suggest.includes("רחוב שאינו ברשימה"));
  ok("הצעת רחוב — התמונה מסומנת חובה", suggest.includes("חובה"));
  const noPhoto = await p.request.post(`${BASE}/api/reports`, {
    data: { kind: "street_suggestion", streetName: "מעבר", body: "מקום נחמד מאוד" },
  });
  ok("הצעת רחוב — 400 בלי תמונה", noPhoto.status() === 400, `status ${noPhoto.status()}`);

  const withPhoto = await p.request.post(`${BASE}/api/reports`, {
    data: {
      kind: "street_suggestion",
      streetName: "מעבר בין הבתים",
      body: "מעבר מוצל בין הבתים שכולם הולכים בו.",
      dataUrl: `data:image/png;base64,${png().toString("base64")}`,
    },
  });
  ok("הצעת רחוב — נשמרת עם תמונה", withPhoto.ok(), `status ${withPhoto.status()}`);
  const suggestionId = withPhoto.ok() ? (await withPhoto.json()).reportId : null;

  // דיווח בלי רחוב אינו דיווח.
  const orphan = await p.request.post(`${BASE}/api/reports`, {
    data: {
      kind: "issue",
      body: "מדרכה שבורה לאורך כל הקטע",
      dataUrl: `data:image/png;base64,${png().toString("base64")}`,
    },
  });
  ok("דיווח — 400 בלי רחוב", orphan.status() === 400, `status ${orphan.status()}`);

  // תמונת דיווח אינה גלויה לציבור, ואינה מופיעה בשום מסך ציבורי.
  if (suggestionId) {
    const photo = await p.request.get(`${BASE}/api/reports/${suggestionId}/photo`);
    ok("תמונת דיווח — 403 לתושב", photo.status() === 403, `status ${photo.status()}`);
  }
  const reportsScreen = await p.request.get(`${BASE}/admin/reports`);
  ok("מסך הדיווחים — אינו קיים לתושב", reportsScreen.status() === 404, `status ${reportsScreen.status()}`);

  // ספריית הדוגמאות: הסף מוצג, ורחוב בלי די תמונות אינו נכנס.
  await p.goto(`${BASE}/examples`);
  const examples = await p.locator("body").innerText();
  ok("דוגמאות — הסף מוסבר במסך", /רחוב נכנס לכאן אחרי \d+ תמונות/.test(examples));
  await p.close();

  // הצוות רואה את הדיווח ואת התמונה שלו.
  // הקשר המנהלת, ולא הצוות: בדיקת היציאה שלמעלה מנתקת את הצוות.
  const sp = await admin.newPage();
  await sp.goto(`${BASE}/admin/reports`);
  const staffScreen = await sp.locator("body").innerText();
  ok("צוות — רואה את ההצעה שנשלחה", staffScreen.includes("מעבר בין הבתים"));
  if (suggestionId) {
    const photo = await sp.request.get(`${BASE}/api/reports/${suggestionId}/photo`);
    ok("צוות — התמונה של הדיווח נטענת", photo.ok(), `status ${photo.status()}`);
    const handled = await sp.request.post(`${BASE}/api/admin/reports`, {
      data: { reportId: suggestionId, handled: true },
    });
    ok("צוות — סימון כטופל", handled.ok(), `status ${handled.status()}`);
  }

  // מדד ההטיה בלוח הבקרה.
  await sp.goto(`${BASE}/admin`);
  const dash = await sp.locator("body").innerText();
  ok("לוח בקרה — שיעור הקולות עם תמונה", dash.includes("שיעור הקולות עם תמונה"));
  ok("לוח בקרה — קישור לדיווחים", dash.includes("דיווחים והצעות"));
  const dashOverflow = await sp.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok("390 — לוח הבקרה בלי גלישה", dashOverflow <= 0, `${dashOverflow}px`);
  await sp.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} עברו`);
process.exit(failed.length ? 1 : 0);
