import { parseRatioRange, FLOOR_HEIGHT_M } from "@/lib/street-section";

/*
 * ערכי הייחוס של סוג הרחוב כמודל תלת־ממדי (ענת, 09.11.2026).
 *
 * המעטפת הירוקה השקופה היא הטווח האידיאלי: רוחב מקיר לקיר בין המינימום
 * למקסימום של הסוג, וגובה החזיתות שנגזר מיחס הרוחב לגובה. הקו הכהה הוא
 * הרחוב כפי שנמדד. כך רואים במבט אחד אם הרחוב צר, רחב או נמוך מהאידיאל,
 * ובכמה. הטבלה שמתחת נותנת את אותם מספרים במדויק.
 */

const K = 4.2;
const COS = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z = 0): [number, number] => [
  (x - y) * COS * K,
  ((x + y) * 0.5 - z) * K,
];
const pts = (list: [number, number, number][]) =>
  list.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(1)).join(",")).join(" ");

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
  const wall = (y: number, h: number) =>
    pts([
      [0, y, 0],
      [L, y, 0],
      [L, y, h],
      [0, y, h],
    ]);

  const corners = [iso(0, 0, 0), iso(L, 0, 0), iso(0, maxW, 0), iso(L, maxW, 0), iso(0, 0, maxH), iso(L, maxW, maxH)];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const pad = 18;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;

  const label = (x: number, y: number, z: number, text: string, cls = "bm-tag") => {
    const [tx, ty] = iso(x, y, z);
    return (
      <text x={tx} y={ty} className={cls} textAnchor="middle">
        {text}
      </text>
    );
  };

  return (
    <figure className="bm">
      <svg viewBox={vb} role="img" aria-label={`מודל ערכי הייחוס ל${typologyLabel}, מול הרחוב שנמדד`}>
        {/* קרקע */}
        <polygon points={pts([[0, 0, 0], [L, 0, 0], [L, maxW, 0], [0, maxW, 0]])} className="bm-ground" />
        {/* רצועת הרוחב האידיאלי על הקרקע */}
        <polygon
          points={pts([
            [0, cy - wRange[1] / 2, 0],
            [L, cy - wRange[1] / 2, 0],
            [L, cy + wRange[1] / 2, 0],
            [0, cy + wRange[1] / 2, 0],
          ])}
          className="bm-ideal-floor"
        />
        <polygon
          points={pts([
            [0, cy - wRange[0] / 2, 0],
            [L, cy - wRange[0] / 2, 0],
            [L, cy + wRange[0] / 2, 0],
            [0, cy + wRange[0] / 2, 0],
          ])}
          className="bm-ideal-floor-core"
        />

        {/* מעטפת הגובה האידיאלית: מהגובה הנמוך לגבוה, בשני הצדדים */}
        {hLow !== null && hHigh !== null ? (
          <>
            <polygon points={wall(cy - midW / 2, hHigh)} className="bm-ideal-wall" />
            <polygon points={wall(cy - midW / 2, hLow)} className="bm-ideal-wall-core" />
            <polygon points={wall(cy + midW / 2, hHigh)} className="bm-ideal-wall" />
            <polygon points={wall(cy + midW / 2, hLow)} className="bm-ideal-wall-core" />
          </>
        ) : null}

        {/* הרחוב כפי שנמדד */}
        {mW !== null ? (
          <>
            <polygon points={wall(cy - mW / 2, mH ?? 0.4)} className="bm-measured" />
            <polygon points={wall(cy + mW / 2, mH ?? 0.4)} className="bm-measured" />
            <polyline
              points={pts([
                [L, cy - mW / 2, 0],
                [L, cy + mW / 2, 0],
              ])}
              className="bm-measure-line"
            />
            {label(L + 1.5, cy, 0, `${mW.toFixed(1)} מ'`, "bm-tag bm-tag-strong")}
          </>
        ) : null}

        {label(0, cy - wRange[1] / 2 - 1, 0, `${wRange[0]}–${wRange[1]} מ'`)}
        {hHigh !== null ? label(0, cy - midW / 2, hHigh + 1, `${hLow!.toFixed(0)}–${hHigh.toFixed(0)} מ' גובה`) : null}
      </svg>
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
