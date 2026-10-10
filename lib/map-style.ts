/**
 * רקע המפה ותוסף העברית — משותפים לכל מפה באפליקציה.
 *
 * שתי מפות (רחובות ורובעים) צריכות את אותו רקע ואת אותו תוסף. כשכל אחת
 * מגדירה אותם לעצמה, אחת מהן מתעדכנת והשנייה לא.
 */

import maplibregl from "maplibre-gl";

/**
 * רקע מונוכרומטרי ורווי-נמוך, כדי שהנתונים יבלטו מעליו ולא יתחרו בו.
 * ניתן להחלפה ברקע העירוני דרך NEXT_PUBLIC_MAP_STYLE (כל style.json).
 */
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** כשאין רקע זמין — הנתונים עדיין נטענים, על רקע ריק. */
export const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f1f2f4" } },
  ],
};

/** הרקע בפועל: משתנה הסביבה אם הוגדר, אחרת ברירת המחדל. */
export function mapStyleUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_STYLE || DEFAULT_STYLE_URL;
}

/**
 * בלי זה הרקע מצייר שמות בעברית הפוכים ("דודשא" במקום "אשדוד"): MapLibre
 * מסדר אותיות משמאל לימין אם התוסף אינו טעון. מוגש מהשרת שלנו.
 */
let rtlPluginRequested = false;
export function ensureRtlTextPlugin() {
  if (rtlPluginRequested) return;
  rtlPluginRequested = true;
  try {
    const state = maplibregl.getRTLTextPluginStatus();
    if (state === "unavailable" || state === "requested") {
      maplibregl.setRTLTextPlugin("/vendor/mapbox-gl-rtl-text.min.js", true);
    }
  } catch {
    // כבר נטען על ידי מופע אחר.
  }
}
