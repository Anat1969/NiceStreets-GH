import { parseRatioRange, FLOOR_HEIGHT_M } from "@/lib/street-section";
import Model3D, { type Label3D, type Shape, type Vec3 } from "@/components/Model3D";

/*
 * ערכי הייחוס של סוג הרחוב כמודל תלת־ממדי (ענת, 09.11.2026).
 *
 * המעטפת הירוקה השקופה היא הטווח האידיאלי: רוחב מקיר לקיר בין המינימום
 * למקסימום של הסוג, וגובה החזיתות שנגזר מיחס הרוחב לגובה. הקו הכהה הוא
 * הרחוב כפי שנמדד. כך רואים במבט אחד אם הרחוב צר, רחב או נמוך מהאידיאל,
 * ובכמה. הטבלה שמתחת נותנת את אותם מספרים במדויק.
 *
 * המודל מסתובב ומוזז בעכבר ובמגע, ויש בו ארבע נקודות מבט קבועות:
 * חזית, חתך, איזומטריה ופרספקטיבה (components/Model3D.tsx).
 */

export function parseMetersRange(text: string): [number, number] | null {
  const xs = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (xs.length === 0 || /משתנה/.test(text)) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export interface Measured {
  widthM: number | null;
  heightM: number | null;
}

export function deviation(value: number | null, range: [number, number] | null): string {
  if (value === null || !range) return "—";
  if (value < range[0]) return `${Math.round(((range[0] - value) / range[0]) * 100)}% מתחת`;
  if (value > range[1]) return `${Math.round(((value - range[1]) / range[1]) * 100)}% מעל`;
  return "בטווח";
}

export default function BenchmarkModel({
  rowWidth,
  ratio,
  measured,
  typologyLabel,
}: {
  rowWidth: string;
  ratio: string;
  measured: Measured;
  typologyLabel: string;
}) {
  const wRange = parseMetersRange(rowWidth);
  const rRange = parseRatioRange(ratio);
  if (!wRange) return null;

  const L = 26; // אורך קטע הרחוב במודל, במטרים
  const midW = (wRange[0] + wRange[1]) / 2;
  // גובה אידיאלי: רוחב חלקי (רוחב לגובה). טווח רחב = נמוך, צר = גבוה.
  const hLow = rRange ? midW / rRange[1] : null;
  const hHigh = rRange ? midW / rRange[0] : null;

  const mW = measured.widthM;
  const mH = measured.heightM;

  const maxW = Math.max(wRange[1], mW ?? 0) + 4;
  const maxH = Math.max(hHigh ?? 0, mH ?? 0, 6) + 2;

  // ציר y חוצה את הרחוב: 0 הוא הקיר הרחוק, מרכז הרחוב ב-maxW/2.
  const cy = maxW / 2;
  const strip = (y0: number, y1: number, z: number, className: string): Shape => ({
    kind: "polygon",
    className,
    points: [
      [0, y0, z],
      [L, y0, z],
      [L, y1, z],
      [0, y1, z],
    ],
  });
  const wall = (y: number, h: number, className: string): Shape => ({
    kind: "polygon",
    className,
    points: [
      [0, y, 0],
      [L, y, 0],
      [L, y, h],
      [0, y, h],
    ],
  });

  const shapes: Shape[] = [
    strip(0, maxW, -0.02, "bm-ground"),
    strip(cy - wRange[1] / 2, cy + wRange[1] / 2, 0, "bm-ideal-floor"),
    strip(cy - wRange[0] / 2, cy + wRange[0] / 2, 0.01, "bm-ideal-floor-core"),
  ];
  if (hLow !== null && hHigh !== null) {
    shapes.push(
      wall(cy - midW / 2, hHigh, "bm-ideal-wall"),
      wall(cy - midW / 2, hLow, "bm-ideal-wall-core"),
      wall(cy + midW / 2, hHigh, "bm-ideal-wall"),
      wall(cy + midW / 2, hLow, "bm-ideal-wall-core"),
    );
  }
  const labels: Label3D[] = [
    { at: [0, cy - wRange[1] / 2 - 1, 0], text: `${wRange[0]}–${wRange[1]} מ'` },
  ];
  if (hLow !== null && hHigh !== null) {
    labels.push({
      at: [0, cy - midW / 2, hHigh + 1],
      text: `${hLow.toFixed(0)}–${hHigh.toFixed(0)} מ' גובה`,
    });
  }
  if (mW !== null) {
    shapes.push(
      wall(cy - mW / 2, mH ?? 0.4, "bm-measured"),
      wall(cy + mW / 2, mH ?? 0.4, "bm-measured"),
      {
        kind: "line",
        className: "bm-measure-line",
        points: [
          [L, cy - mW / 2, 0.05],
          [L, cy + mW / 2, 0.05],
        ],
      },
    );
    labels.push({ at: [L + 1.5, cy, 0], text: `${mW.toFixed(1)} מ'`, className: "bm-tag bm-tag-strong" });
  }
  const center: Vec3 = [L / 2, cy, maxH / 3];

  return (
    <figure className="bm">
      <Model3D
        shapes={shapes}
        labels={labels}
        center={center}
        size={Math.max(L, maxW, maxH)}
        ariaLabel={`מודל ערכי הייחוס ל${typologyLabel}, מול הרחוב שנמדד`}
        initial="iso"
        height={170}
      />
      <figcaption className="bm-legend">
        <span>
          <i className="bm-key bm-key-ideal" /> הטווח האידיאלי ל{typologyLabel}
        </span>
        <span>
          <i className="bm-key bm-key-measured" /> הרחוב כפי שנמדד
        </span>
      </figcaption>
      <p className="how">
        המעטפת השקופה היא הטווח: הכהה יותר הוא המינימום, הבהיר הוא המקסימום. גובה החזית נגזר מיחס
        הרוחב לגובה, בהנחה של {FLOOR_HEIGHT_M} מ&apos; לקומה.
      </p>
    </figure>
  );
}
