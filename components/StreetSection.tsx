"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StreetSectionRecord } from "@/lib/types";
import {
  DEFAULT_FLOORS,
  FLOOR_HEIGHT_M,
  knownFloors,
  measureSection,
  overpassQuery,
  parseOverpass,
  parseRatioRange,
  ratioVerdict,
  type LonLat,
  type SectionMeasure,
} from "@/lib/street-section";

/*
 * שרתי Overpass, לפי הסדר. הראשי עמוס לעיתים קרובות ומחזיר 502, ולכן
 * מתחילים במראה שלו. כל ניסיון מוגבל ל-20 שניות.
 */
const ENDPOINTS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "ready"; measure: SectionMeasure; fetchedAt: string };

const cacheKey = ([lon, lat]: LonLat) => `ns-section:v1:${lon.toFixed(5)},${lat.toFixed(5)}`;

async function fetchOsm(center: LonLat): Promise<unknown> {
  const body = "data=" + encodeURIComponent(overpassQuery(center));
  for (const url of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch {
      /* השרת הבא. */
    }
  }
  throw new Error("overpass");
}

function Stepper({
  label,
  value,
  source,
  onChange,
}: {
  label: string;
  value: number;
  source: "osm" | "estimate" | "user" | "saved";
  onChange: (v: number) => void;
}) {
  const sourceText =
    source === "osm"
      ? "מ-OpenStreetMap"
      : source === "saved"
        ? "אושר על ידי הצוות"
        : source === "user"
          ? "תוקן ביד"
          : "הערכה, תקנו לפי מה שרואים";
  return (
    <div className="flex-1">
      <div className="mb-1 text-[13px] font-semibold text-ink">{label}</div>
      <div className="flex items-center gap-1" role="group" aria-label={`קומות, ${label}`}>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="section-step"
          aria-label={`פחות קומות, ${label}`}
        >
          −
        </button>
        <span className="min-w-12 text-center text-[20px] font-bold tabular-nums text-ink">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(40, value + 1))}
          className="section-step"
          aria-label={`יותר קומות, ${label}`}
        >
          +
        </button>
      </div>
      <div
        className={`mt-1 text-[12px] ${source === "estimate" ? "text-warm" : "text-ink-faint"}`}
      >
        {sourceText}
      </div>
    </div>
  );
}

/** השרטוט: שני בניינים, הרוחב ביניהם, ואדם לקנה מידה. */
function Drawing({
  widthM,
  floorsA,
  floorsB,
  ratioText,
}: {
  widthM: number;
  floorsA: number;
  floorsB: number;
  ratioText: string;
}) {
  const hA = floorsA * FLOOR_HEIGHT_M;
  const hB = floorsB * FLOOR_HEIGHT_M;
  const bldW = 12;
  const totalW = widthM + bldW * 2;
  const VW = 360;
  const VH = 230;
  const ground = VH - 34;
  const scale = Math.min((VW - 24) / totalW, (ground - 30) / Math.max(hA, hB, 6));
  const x0 = (VW - totalW * scale) / 2;
  const xGapStart = x0 + bldW * scale;
  const xGapEnd = xGapStart + widthM * scale;
  const person = 1.75 * scale;
  const mid = (xGapStart + xGapEnd) / 2;

  /* קומות כקווים דקים בתוך הבניין: כך רואים את המספר, לא רק את הגובה. */
  const floorLines = (x: number, floors: number) =>
    Array.from({ length: floors - 1 }, (_, i) => {
      const y = ground - (i + 1) * FLOOR_HEIGHT_M * scale;
      return <line key={i} x1={x} x2={x + bldW * scale} y1={y} y2={y} className="section-floor" />;
    });

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="section-drawing h-auto w-full"
      role="img"
      aria-label={`חתך הרחוב: רוחב ${Math.round(widthM)} מטר בין הקירות, ${floorsA} ו-${floorsB} קומות, יחס גובה לרוחב ${ratioText}`}
    >
      <line x1={8} x2={VW - 8} y1={ground} y2={ground} className="section-ground" />
      {/* צד א' מימין וצד ב' משמאל, כמו הכפתורים שמתחת לשרטוט. */}
      <g className="section-bld">
        <rect x={x0} y={ground - hB * scale} width={bldW * scale} height={hB * scale} />
        {floorLines(x0, floorsB)}
      </g>
      <g className="section-bld">
        <rect x={xGapEnd} y={ground - hA * scale} width={bldW * scale} height={hA * scale} />
        {floorLines(xGapEnd, floorsA)}
      </g>

      {/* מידת הרוחב, מקיר לקיר. */}
      <g className="section-dim">
        <line x1={xGapStart} x2={xGapEnd} y1={ground + 14} y2={ground + 14} />
        <line x1={xGapStart} x2={xGapStart} y1={ground + 8} y2={ground + 20} />
        <line x1={xGapEnd} x2={xGapEnd} y1={ground + 8} y2={ground + 20} />
      </g>
      <text x={mid} y={ground + 29} textAnchor="middle" direction="ltr" className="section-label">
        {Math.round(widthM)} m
      </text>
      <text
        x={x0 + (bldW * scale) / 2}
        y={ground - hB * scale - 6}
        textAnchor="middle"
        direction="ltr"
        className="section-label"
      >
        {hB} m
      </text>
      <text
        x={xGapEnd + (bldW * scale) / 2}
        y={ground - hA * scale - 6}
        textAnchor="middle"
        direction="ltr"
        className="section-label"
      >
        {hA} m
      </text>

      {/* אדם בגובה 1.75 מ', כדי שהמספרים יקבלו גוף. */}
      <g className="section-person">
        <circle cx={mid} cy={ground - person + person * 0.12} r={Math.max(1.2, person * 0.12)} />
        <line x1={mid} x2={mid} y1={ground - person * 0.76} y2={ground - person * 0.3} />
        <line x1={mid} x2={mid - person * 0.14} y1={ground - person * 0.3} y2={ground} />
        <line x1={mid} x2={mid + person * 0.14} y1={ground - person * 0.3} y2={ground} />
      </g>

      {/* קו המבט מראש הבניין לעין: הזווית היא מה שיוצר את תחושת "החדר". */}
      <line
        x1={mid}
        y1={ground - person * 0.9}
        x2={xGapEnd}
        y2={ground - hA * scale}
        className="section-sight"
      />
    </svg>
  );
}

export default function StreetSection({
  streetId,
  streetName,
  center,
  typologyLabel,
  benchmark,
  gisHeightToWidth,
  saved,
  staff,
}: {
  streetId: string;
  saved: StreetSectionRecord | null;
  staff: boolean;
  streetName: string;
  center: LonLat;
  typologyLabel: string | null;
  benchmark: string | null;
  gisHeightToWidth: number | null;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [floorsA, setFloorsA] = useState<number | null>(null);
  const [floorsB, setFloorsB] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const key = cacheKey(center);
    (async () => {
      try {
        let raw: unknown = null;
        let fetchedAt = "";
        try {
          const cached = JSON.parse(localStorage.getItem(key) ?? "null");
          if (cached?.raw) {
            raw = cached.raw;
            fetchedAt = cached.at;
          }
        } catch {
          /* אין מטמון, ממשיכים לרשת. */
        }
        if (!raw) {
          raw = await fetchOsm(center);
          fetchedAt = new Date().toLocaleDateString("he-IL");
          try {
            localStorage.setItem(key, JSON.stringify({ raw, at: fetchedAt }));
          } catch {
            /* אחסון מלא או חסום: המדידה עדיין מוצגת. */
          }
        }
        const measure = measureSection(center, parseOverpass(raw), streetName);
        if (!alive) return;
        setState(measure ? { kind: "ready", measure, fetchedAt } : { kind: "none" });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [center, streetName, attempt]);

  const measure = state.kind === "ready" ? state.measure : null;
  const osmA = measure ? knownFloors(measure.left.building) : null;
  const osmB = measure ? knownFloors(measure.right.building) : null;
  /* סדר העדיפות לקומות: מה שתוקן עכשיו, מה שהצוות אישר, OpenStreetMap, הערכה. */
  const fA = floorsA ?? saved?.floorsA ?? osmA ?? DEFAULT_FLOORS;
  const fB = floorsB ?? saved?.floorsB ?? osmB ?? DEFAULT_FLOORS;
  const sourceOf = (user: number | null, savedFloors: number | undefined, osm: number | null) =>
    user !== null ? "user" : savedFloors !== undefined ? "saved" : osm !== null ? "osm" : "estimate";
  const range = useMemo(() => (benchmark ? parseRatioRange(benchmark) : null), [benchmark]);

  if (state.kind === "loading") {
    return (
      <div className="card p-4">
        <p className="text-[14px] text-ink-soft">מודד את הרחוב מתוך OpenStreetMap…</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="card p-4">
        <p className="mb-2 text-[14px] text-ink">
          שרת המפות הפתוח לא ענה כרגע. זה קורה כשהוא עמוס, ובדרך כלל עובר תוך דקה.
        </p>
        <button
          type="button"
          className="section-step px-4"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((a) => a + 1);
          }}
        >
          לנסות שוב
        </button>
      </div>
    );
  }
  if (state.kind === "none" || !measure) {
    return (
      <div className="card p-4">
        <p className="text-[14px] text-ink">
          לא נמצאו קירות בניינים משני צידי הרחוב ליד המרכז שלו, ולכן אין כאן מדידה.
        </p>
        <p className="mt-1 text-[13px] text-ink-faint">
          כך קורה ברחוב שצד אחד שלו פתוח (פארק, חניון, ים), או כשהבניינים לא שורטטו
          במפה הפתוחה.
        </p>
      </div>
    );
  }

  const heightM = ((fA + fB) / 2) * FLOOR_HEIGHT_M;
  const widthPerHeight = measure.widthM / heightM;
  const ratioText = `1:${widthPerHeight.toFixed(1)}`;
  const verdict = range ? ratioVerdict(widthPerHeight, range) : null;
  const srcA = sourceOf(floorsA, saved?.floorsA, osmA);
  const srcB = sourceOf(floorsB, saved?.floorsB, osmB);
  const usedEstimate = srcA === "estimate" || srcB === "estimate";

  async function saveSection() {
    if (!measure) return;
    setSaveState("busy");
    const res = await fetch("/api/admin/street-section", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streetId, facadeWidthM: measure.widthM, floorsA: fA, floorsB: fB }),
    }).catch(() => null);
    if (res?.ok) {
      setSaveState("done");
      setFloorsA(null);
      setFloorsB(null);
      router.refresh();
    } else {
      setSaveState("error");
    }
  }

  const verdictLine =
    verdict === "within"
      ? { cls: "section-solution", text: `בטווח היעד ל${typologyLabel ?? "סוג הרחוב"}.` }
      : verdict === "wide"
        ? {
            cls: "section-problem",
            text: "רחב מהיעד: הבניינים נמוכים ביחס לרוחב, ותחושת ה\"חדר\" נחלשת.",
          }
        : verdict === "narrow"
          ? { cls: "section-problem", text: "צר מהיעד: הרחוב סגור יותר מהמקובל לסוג שלו." }
          : null;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink-faint">גובה : רוחב</span>
        <span className="text-[34px] font-bold leading-none tabular-nums text-ink" dir="ltr">
          {ratioText}
        </span>
        {measure.confidence === "low" ? (
          <span className="text-[13px] font-semibold text-warm">מדידה לא חד־משמעית</span>
        ) : null}
      </div>

      {verdictLine ? (
        <p className="mb-1 text-[15px] font-semibold text-ink">
          <span className={verdictLine.cls}>{verdictLine.text}</span>
        </p>
      ) : null}
      <p className="mb-3 text-[14px] text-ink-soft">
        {range ? (
          <>
            היעד ל{typologyLabel}: <bdi dir="ltr">1:{range[0]}</bdi> עד{" "}
            <bdi dir="ltr">1:{range[1]}</bdi>. לכל מטר גובה,{" "}
            <strong className="text-ink">{widthPerHeight.toFixed(1)} מטר</strong> רוחב.
          </>
        ) : (
          <>
            לכל מטר גובה, <strong className="text-ink">{widthPerHeight.toFixed(1)} מטר</strong>{" "}
            רוחב.
          </>
        )}
      </p>

      <Drawing widthM={measure.widthM} floorsA={fA} floorsB={fB} ratioText={ratioText} />

      <div className="mt-3 flex gap-3">
        <Stepper
          label="צד א'"
          value={fA}
          source={srcA}
          onChange={setFloorsA}
        />
        <Stepper
          label="צד ב'"
          value={fB}
          source={srcB}
          onChange={setFloorsB}
        />
      </div>
      {usedEstimate ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          לבניינים כאן אין מספר קומות במפה הפתוחה. ספרו את הקומות שאתם רואים, והיחס
          יתעדכן מיד.
        </p>
      ) : null}

      {staff ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <button
            type="button"
            className="section-step px-4 text-[15px]"
            disabled={saveState === "busy"}
            onClick={saveSection}
          >
            {saved ? "עדכון החתך המאושר" : "אישור החתך לרחוב"}
          </button>
          <span className="text-[13px] text-ink-soft">
            {saveState === "busy"
              ? "שומר…"
              : saveState === "done"
                ? "נשמר. הקומות האלה יוצגו מעכשיו לכל מי שנכנס לרחוב."
                : saveState === "error"
                  ? "השמירה נכשלה. בדקו שאתם מחוברים כצוות ונסו שוב."
                  : saved
                    ? `אושר ב-${saved.measuredAt.split("-").reverse().join(".")}: ${saved.floorsA} ו-${saved.floorsB} קומות, ${saved.facadeWidthM} מ׳.`
                    : "ספרו את הקומות בשני הצדדים, ואשרו. שדה ה-GIS העירוני לא משתנה."}
          </span>
        </div>
      ) : null}

      <details className="mt-3 border-t border-line pt-2 text-[13px] text-ink-soft">
        <summary className="cursor-pointer font-semibold text-ink">איך נמדד</summary>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>
            <strong className="text-ink">רוחב, נמדד בקוד:</strong> בשבע נקודות לאורך{" "}
            {measure.matchedByName ? `ציר "${streetName}"` : "הרחוב הקרוב למרכז"} נמצא
            קיר הבניין הקרוב בכל צד. החציון:{" "}
            <strong className="text-ink">{measure.widthM.toFixed(1)} מ׳</strong>, טווח{" "}
            {measure.minWidthM.toFixed(0)} עד {measure.maxWidthM.toFixed(0)} מ׳,{" "}
            {measure.validSamples} מתוך {measure.totalSamples} נקודות מצאו קיר בשני הצדדים.
          </li>
          <li>
            זה רוחב מקיר לקיר, כולל מרווחי הבניין. רוחב זכות הדרך, בין קווי המגרש,
            קטן ממנו.
          </li>
          <li>
            <strong className="text-ink">גובה:</strong> מספר הקומות כפול {FLOOR_HEIGHT_M}{" "}
            מ׳, גובה קומה מקובל. באשדוד רק לכ-7% מהבניינים במפה הפתוחה רשום מספר
            קומות, ולכן ברוב הרחובות הגובה הוא שלכם.
          </li>
          {gisHeightToWidth ? (
            <li>
              ערך ה-GIS העירוני לרחוב:{" "}
              <span dir="ltr">1:{(1 / gisHeightToWidth).toFixed(1)}</span>.
            </li>
          ) : null}
          {measure.confidence === "low" ? (
            <li>
              הדגימות כאן רחוקות זו מזו או מעטות, כנראה בגלל צומת או שטח פתוח. המספר
              מוצג, אבל אינו מדידה של הרחוב כולו.
            </li>
          ) : null}
          <li>
            נתונים: © OpenStreetMap contributors, רישיון ODbL, נשלפו ב-{state.fetchedAt}.
          </li>
        </ul>
      </details>
    </div>
  );
}
