/**
 * מיקום רחוב מ-OpenStreetMap, דרך Nominatim.
 *
 * שירות חופשי, בלי מפתח ובלי חשבון, ורישיון ODbL שמחייב ייחוס — הייחוס
 * מופיע במקרא של המפה ובכיתוב של מפת הרקע.
 *
 * שתי מלכודות שנפלו בהן כאן ותוקנו:
 *
 * 1. המרשם הארצי כותב "שד הרצל" ו"דרך בגין מנחם". ב-OSM הרחובות נקראים
 *    "שדרות הרצל" ו"שדרות מנחם בגין". חיפוש בשם הגולמי החזיר ריק לחמישה
 *    מתוך שנים־עשר הרחובות הראשונים. לכן מנסים כמה צורות, לפי סדר.
 * 2. כשאין התאמה, Nominatim מחזיר לפעמים מקום אחר לגמרי — רחוב באשקלון
 *    כשמחפשים שכונה באשדוד. לכן נבדק שהתוצאה אכן באשדוד לפני שהיא נשמרת.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "GoodStreetsAshdod/1.0 (municipal participation app)";

/** צורות כתיב שונות של אותו רחוב, מהמדויקת לרחבה. */
export function nameVariants(name: string): string[] {
  const raw = name.trim();
  const out = new Set<string>([raw]);

  // קיצורים שהמרשם הארצי משתמש בהם, והשם המלא ש-OSM מכיר.
  const expanded = raw
    .replace(/^שד['"׳]?\s+/, "שדרות ")
    .replace(/^רח['"׳]?\s+/, "")
    .replace(/^דר['"׳]?\s+/, "דרך ");
  out.add(expanded);

  // בלי הקידומת בכלל: "דרך בגין מנחם" → "בגין מנחם".
  const bare = expanded.replace(/^(שדרות|דרך|סמטת|שביל)\s+/, "");
  out.add(bare);

  // סדר מילים הפוך: המרשם כותב "בגין מנחם", ברחוב כתוב "מנחם בגין".
  const words = bare.split(/\s+/);
  if (words.length === 2) out.add(`${words[1]} ${words[0]}`);

  return [...out].filter(Boolean);
}

interface NominatimHit {
  lon: string;
  lat: string;
  display_name?: string;
}

async function query(url: string): Promise<NominatimHit | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, "accept-language": "he" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as NominatimHit[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * מחזיר [lon, lat], או null כשאין התאמה בטוחה.
 *
 * null הוא תשובה לגיטימית: רחוב בלי מיקום פשוט אינו מצויר. מיקום משוער
 * שנראה כמו מיקום אמיתי גרוע ממפה חסרה.
 */
export async function geocodeStreet(
  name: string,
  city: string,
): Promise<[number, number] | null> {
  for (const variant of nameVariants(name)) {
    const url =
      `${ENDPOINT}?format=json&limit=1&countrycodes=il` +
      `&street=${encodeURIComponent(variant)}&city=${encodeURIComponent(city)}`;
    const hit = await query(url);
    if (hit && (hit.display_name ?? "").includes(city)) {
      return [Number(hit.lon), Number(hit.lat)];
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return null;
}
