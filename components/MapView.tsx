"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { votesLabel } from "@/lib/hebrew";

interface QuarterPoint {
  id: string;
  name: string;
  /** מיקום אמיתי בלבד. רובע שטרם מוקם אינו מגיע לכאן. */
  center: [number, number];
  votes: number;
  avgScore: number | null;
  /** מאיפה הגיע המיקום. "approx" מסומן במפה כמשוער. */
  centerSource?: string | null;
}

interface StreetFeature {
  id: string;
  code: string | null;
  name: string;
  quarterId: string;
  votes: number;
  avgScore: number | null;
  /** קו מה-GIS העירוני, כשהוא קיים. */
  line?: [number, number][];
  /** מרכז הרחוב מ-OpenStreetMap, כשאין קו. */
  center?: [number, number];
  /** מאיפה הגיע המיקום. null = טרם מוקם. */
  centerSource?: string | null;
}

interface Props {
  center: [number, number];
  zoom: number;
  quarters: QuarterPoint[];
  /** רובעים שטרם מוקמו — מוצגים מתחת למפה, לא עליה. */
  unplaced: { id: string; name: string; votes: number }[];
  streets: StreetFeature[];
  streetLinesAvailable: boolean;
  canCalibrate?: boolean;
}

/**
 * רקע מונוכרומטרי ורווי-נמוך, כדי שהנתונים יבלטו מעליו ולא יתחרו בו.
 * ניתן להחלפה ברקע העירוני דרך NEXT_PUBLIC_MAP_STYLE (כל style.json).
 */
const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** כשאין רקע זמין — הנתונים עדיין נטענים, על רקע ריק. */
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f1f2f4" } },
  ],
};

/**
 * סולם רצוף בחמישה שלבים לציון הממוצע, באותם צבעים של סולם 1–5 באפליקציה,
 * כדי שמשמעות הצבע תהיה זהה בכל מסך.
 */
const SCORE_COLORS = ["#e0a99c", "#eec79a", "#e3d98f", "#b3d596", "#8ec7a4"];
const NO_SCORE_COLOR = "#c3c8cf";

function scoreColor(score: number | null): string {
  if (score === null) return NO_SCORE_COLOR;
  const step = Math.min(4, Math.max(0, Math.round(score) - 1));
  return SCORE_COLORS[step];
}

/**
 * בלי זה הרקע מצייר שמות בעברית הפוכים ("דודשא" במקום "אשדוד"): MapLibre
 * מסדר אותיות משמאל לימין אם התוסף אינו טעון. מוגש מהשרת שלנו.
 */
let rtlPluginRequested = false;
function ensureRtlTextPlugin() {
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

export default function MapView({
  center,
  zoom,
  quarters,
  unplaced,
  streets,
  streetLinesAvailable,
  canCalibrate = false,
}: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const labels = useRef<maplibregl.Marker[]>([]);

  /*
   * שתי תצוגות, ושני כפתורים: קולות לפי רובע, או קולות לפי רחוב.
   * קודם לכן המעבר ביניהן היה תלוי בזום, ולכן אי אפשר היה לבקש אותו —
   * ומי שלא ידע להתקרב מספיק לא ראה רחובות מעולם.
   */
  const [mode, setMode] = useState<"quarter" | "street">("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");
  const [legendOpen, setLegendOpen] = useState(false);

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState("");
  const calibratingRef = useRef("");
  /** "quarter" או "street" — מה שומרים בלחיצה הבאה על המפה. */
  const [placing, setPlacing] = useState<"quarter" | "street">("quarter");
  const placingRef = useRef<"quarter" | "street">("quarter");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const maxQuarterVotes = useMemo(
    () => Math.max(1, ...quarters.map((q) => q.votes)),
    [quarters],
  );
  const maxStreetVotes = useMemo(
    () => Math.max(1, ...streets.map((s) => s.votes)),
    [streets],
  );

  const linedStreets = useMemo(
    () => streets.filter((s) => s.line && s.line.length > 1),
    [streets],
  );

  /** רחוב מגיע למפה רק אם יש לו מיקום אמיתי — קו מה-GIS או נקודה מ-OSM. */
  const placedStreets = useMemo(
    () => streets.filter((s) => s.center || (s.line && s.line.length > 1)),
    [streets],
  );

  const streetPoint = useCallback(
    (s: StreetFeature): [number, number] =>
      s.center ?? (s.line as [number, number][])[Math.floor((s.line as []).length / 2)],
    [],
  );

  const shown = mode === "quarter" ? quarters.length : placedStreets.length;

  /* מיקום משוער נאמר במפורש במקרא, ולא מוצג כאילו נמדד. */
  const approx = useMemo(
    () => quarters.filter((q) => q.centerSource === "approx"),
    [quarters],
  );
  const approxCount = approx.length;
  const approxNames = approx.map((q) => q.name).join(" · ");

  const saveQuarter = useCallback(
    async (targetId: string, point: [number, number]) => {
      setSaveMessage(null);
      const street = placingRef.current === "street";
      const response = await fetch(
        street ? "/api/admin/street-center" : "/api/admin/quarter",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            street
              ? { streetId: targetId, center: point }
              : { quarterId: targetId, center: point },
          ),
        },
      );
      if (response.ok) {
        setSaveMessage(
          placingRef.current === "street" ? "הרחוב מוקם במפה." : "הרובע מוקם במפה.",
        );
        setCalibrating("");
        calibratingRef.current = "";
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setSaveMessage(data.error ?? "השמירה נכשלה.");
      }
    },
    [router],
  );

  const runGeocode = useCallback(async () => {
    setGeocoding(true);
    setGeocodeMessage(null);
    try {
      const response = await fetch("/api/admin/geocode", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "החיפוש נכשל");
      const placed = (data.placed as string[] | undefined) ?? [];
      const failed = (data.failed as string[] | undefined) ?? [];
      setGeocodeMessage(
        placed.length === 0 && failed.length === 0
          ? "כל הרחובות כבר ממוקמים."
          : `מוקמו ${placed.length}${
              failed.length > 0 ? `; לא נמצאו ${failed.length}: ${failed.join(", ")}` : ""
            }.`,
      );
      router.refresh();
    } catch (error) {
      setGeocodeMessage(error instanceof Error ? error.message : "החיפוש נכשל");
    } finally {
      setGeocoding(false);
    }
  }, [router]);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

  useEffect(() => {
    calibratingRef.current = calibrating;
    if (map.current) {
      map.current.getCanvas().style.cursor = calibrating ? "crosshair" : "";
    }
  }, [calibrating]);

  useEffect(() => {
    if (!container.current || map.current) return;
    ensureRtlTextPlugin();

    const instance = new maplibregl.Map({
      container: container.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE ?? DEFAULT_STYLE_URL,
      center,
      zoom,
      attributionControl: { compact: true },
      // מכשיר בינוני: בלי סיבוב ובלי הטיה, פחות ציור ופחות מגע בשוגג.
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    instance.touchZoomRotate.disableRotation();

    let usedFallback = false;

    function addData() {
      if (instance.getSource("quarters") || instance.getSource("street-points")) return;

      if (mode === "street") {
        addStreetPoints();
        return;
      }

      instance.addSource("quarters", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: quarters.map((q) => ({
            type: "Feature",
            id: q.id,
            geometry: { type: "Point", coordinates: q.center },
            properties: {
              id: q.id,
              name: q.name,
              votes: q.votes,
              color: scoreColor(q.avgScore),
            },
          })),
        },
      });

      /*
       * עיגול לרובע: הגודל הוא מספר הקולות, הצבע הוא הציון הממוצע.
       * שתי המידות נפרדות, כך שרובע עם הרבה קולות וציון נמוך נראה שונה
       * מרובע עם מעט קולות וציון גבוה.
       */
      instance.addLayer({
        id: "quarter-circles",
        type: "circle",
        source: "quarters",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["sqrt", ["get", "votes"]],
            0, 10,
            Math.sqrt(maxQuarterVotes), 34,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#16202b",
          "circle-stroke-opacity": 0.9,
        },
      });

      instance.on("click", "quarter-circles", (event) => {
        if (calibratingRef.current) return;
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) {
          setSelectedQuarter(id);
          setSelectedStreet(null);
        }
      });
      instance.on("mouseenter", "quarter-circles", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "quarter-circles", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "";
      });
    }

    /**
     * תצוגת הרחובות: קו כשיש שכבת GIS עירונית, ואחרת נקודה מ-OpenStreetMap.
     * בשני המקרים העובי או הגודל הם מספר הקולות, והצבע הוא הציון הממוצע —
     * אותה משמעות בדיוק כמו בתצוגת הרובעים.
     */
    function addStreetPoints() {
      if (linedStreets.length > 0) {
        instance.addSource("street-lines-src", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: linedStreets.map((s) => ({
              type: "Feature",
              id: s.id,
              geometry: { type: "LineString", coordinates: s.line as [number, number][] },
              properties: { id: s.id, name: s.name, votes: s.votes, color: scoreColor(s.avgScore) },
            })),
          },
        });
        instance.addLayer({
          id: "street-lines",
          type: "line",
          source: "street-lines-src",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": [
              "interpolate",
              ["linear"],
              ["sqrt", ["get", "votes"]],
              0, 3,
              Math.sqrt(maxStreetVotes), 12,
            ],
            "line-opacity": 0.9,
          },
        });
        instance.on("click", "street-lines", (event) => {
          if (calibratingRef.current) return;
          const id = event.features?.[0]?.properties?.id as string | undefined;
          if (id) {
            setSelectedStreet(id);
            setSelectedQuarter(null);
          }
        });
      }

      instance.addSource("street-points", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: placedStreets.map((s) => ({
            type: "Feature",
            id: s.id,
            geometry: { type: "Point", coordinates: streetPoint(s) },
            properties: {
              id: s.id,
              name: s.name,
              votes: s.votes,
              color: scoreColor(s.avgScore),
            },
          })),
        },
      });

      instance.addLayer({
        id: "street-circles",
        type: "circle",
        source: "street-points",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["sqrt", ["get", "votes"]],
            0, 9,
            Math.sqrt(maxStreetVotes), 26,
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#16202b",
        },
      });

      instance.on("click", "street-circles", (event) => {
        if (calibratingRef.current) return;
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) {
          setSelectedStreet(id);
          setSelectedQuarter(null);
        }
      });
      instance.on("mouseenter", "street-circles", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "street-circles", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "";
      });
    }

    /**
     * תוויות הרובעים הן HTML ולא גליפים של המפה: הדפדפן מסדר עברית נכון
     * בעצמו, והתוויות שורדות גם רקע בלי שרת גליפים.
     */
    function addLabels() {
      labels.current.forEach((m) => m.remove());
      /*
       * תווית לכל נקודה הפכה את המפה לערמת בועות: 22 רובעים, שרובם בלי
       * קולות, כיסו זה את זה ואת העיר. תווית מופיעה רק כשיש מה לספור;
       * מקום בלי קולות נשאר עיגול שקט, ושמו מופיע בהקשה עליו.
       */
      const items =
        mode === "quarter"
          ? quarters
              .filter((q) => q.votes > 0)
              .map((q) => ({
              id: q.id,
              name: q.name,
              votes: q.votes,
              at: q.center,
              pick: () => {
                setSelectedQuarter(q.id);
                setSelectedStreet(null);
              },
            }))
          : placedStreets
              .filter((s) => s.votes > 0)
              .map((s) => ({
              id: s.id,
              name: s.name,
              votes: s.votes,
              at: streetPoint(s),
              pick: () => {
                setSelectedStreet(s.id);
                setSelectedQuarter(null);
              },
            }));

      labels.current = items.map((item) => {
        const el = document.createElement("button");
        el.type = "button";
        el.dir = "rtl";
        /*
         * השם והמספר יחד, על הנקודה עצמה. מפה שמראה עיגול בלי מספר
         * מחייבת להקיש כדי לדעת כמה — וזה בדיוק מה שהמפה אמורה לחסוך.
         */
        el.className =
          "flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-2 py-[3px] text-[12px] text-ink shadow-sm";
        const name = document.createElement("span");
        name.textContent = item.name;
        const count = document.createElement("span");
        count.textContent = String(item.votes);
        count.className = "font-bold tabular-nums text-accent";
        el.append(name, count);
        el.setAttribute("aria-label", `${item.name}, ${votesLabel(item.votes)}`);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!calibratingRef.current) item.pick();
        });
        return new maplibregl.Marker({ element: el, offset: [0, -26] })
          .setLngLat(item.at)
          .addTo(instance);
      });
    }

    /** המפה נפתחת על מה שיש עליה, ולא על מרכז קבוע שאולי ריק. */
    function fitToData() {
      const points =
        mode === "quarter"
          ? quarters.map((q) => q.center)
          : placedStreets.map((s) => streetPoint(s));
      if (points.length < 2) return;
      const bounds = points.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(points[0], points[0]),
      );
      instance.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
    }

    /*
     * המפה מודדת את עצמה פעם אחת בעת היצירה. אם המסגרת עוד לא קיבלה
     * את גובהה הסופי באותו רגע, הקנבס נשאר בגודל השגוי לתמיד. המשקיף
     * הזה מיישר אותו בכל שינוי גודל — כולל סיבוב מכשיר.
     */
    const resizeObserver = new ResizeObserver(() => instance.resize());
    if (container.current) resizeObserver.observe(container.current);

    instance.on("load", () => {
      if (!usedFallback) setBasemap("ready");
      addData();
      addLabels();
      fitToData();
    });

    instance.on("error", (event) => {
      const message = String(event?.error?.message ?? "");
      const styleFailed = !instance.isStyleLoaded() || message.includes("style");
      if (styleFailed && !usedFallback) {
        usedFallback = true;
        setBasemap("none");
        instance.setStyle(BLANK_STYLE);
        instance.once("styledata", () => {
          addData();
          addLabels();
          fitToData();
        });
      }
    });

    instance.on("click", (event) => {
      const quarterId = calibratingRef.current;
      if (!quarterId) return;
      void saveQuarter(quarterId, [event.lngLat.lng, event.lngLat.lat]);
    });

    return () => {
      resizeObserver.disconnect();
      labels.current.forEach((m) => m.remove());
      labels.current = [];
      instance.remove();
      map.current = null;
    };
  }, [
    center,
    zoom,
    mode,
    quarters,
    linedStreets,
    placedStreets,
    streetPoint,
    maxQuarterVotes,
    maxStreetVotes,
    saveQuarter,
  ]);

  const quarter = quarters.find((q) => q.id === selectedQuarter) ?? null;
  const street = streets.find((s) => s.id === selectedStreet) ?? null;
  const quarterStreets = quarter
    ? streets
        .filter((s) => s.quarterId === quarter.id)
        .sort((a, b) => b.votes - a.votes || (b.avgScore ?? 0) - (a.avgScore ?? 0))
    : [];

  const sheetOpen = quarter !== null || street !== null;

  return (
    <div className="map-screen">
      {/* שני כפתורים, לא תלות בזום: מה סופרים ואיפה מציגים את המספר. */}
      <div
        className="mb-2 flex gap-2"
        role="group"
        aria-label="מה מוצג על המפה"
      >
        {(
          [
            ["quarter", "מיפוי קולות לפי רובע", quarters.length],
            ["street", "מיפוי קולות לפי רחוב", placedStreets.length],
          ] as ["quarter" | "street", string, number][]
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => {
              setMode(value);
              setSelectedQuarter(null);
              setSelectedStreet(null);
            }}
            className={`pressable flex-1 rounded-[12px] px-3 py-2 text-[14px] ${
              mode === value
                ? "bg-accent font-semibold text-white"
                : "border border-line bg-surface text-ink"
            }`}
          >
            {label}
            <span className="mr-1 tabular-nums opacity-80">({count})</span>
          </button>
        ))}
      </div>

      <div className="map-canvas-wrap">
        <div
          ref={container}
          role="application"
          aria-label="מפת אשדוד"
          className="map-canvas"
        />

        {/* אין מה לצייר: נאמר במפורש, במקום להשאיר רקע ריק בלי הסבר. */}
        {shown === 0 ? (
          <div className="map-empty card">
            <p className="text-[15px] font-medium text-ink">עדיין אין נתונים על המפה</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {mode === "quarter"
                ? "אף רובע לא מוקם עדיין במקומו האמיתי."
                : "אף רחוב שקיבל קולות לא מוקם עדיין במקומו האמיתי."}{" "}
              הרשימה והדירוגים עובדים כרגיל במסך הטבלה.
            </p>
          </div>
        ) : null}

        {/* מקרא: טקסט בלבד, מקופל כברירת מחדל, ואינו מכסה את המפה. */}
        <details
          open={legendOpen}
          onToggle={(e) => setLegendOpen((e.target as HTMLDetailsElement).open)}
          className="map-legend card"
        >
          <summary className="cursor-pointer list-none px-3 py-2 text-[14px] font-medium text-ink">
            מקרא
          </summary>
          <div className="border-t border-line px-3 py-2 text-[13px] text-ink-soft">
            <p>
              עיגול = {mode === "quarter" ? "רובע" : "רחוב"}. הגודל לפי מספר
              הקולות, הצבע לפי הציון הממוצע. המספר שעל התווית הוא מספר הקולות.
            </p>
            <p className="mt-1">
              הצבעים, מהנמוך לגבוה: גרוע · חלש · בינוני · טוב · מצוין. אפור = אין עדיין ציון.
            </p>
            <p className="mt-1 text-ink-faint">
              המיקומים נשלפו מ-OpenStreetMap לפי שם הרחוב או הרובע, ואינם שכבת
              ה-GIS העירונית. רחוב מסומן בנקודה אחת, לא בקו לכל אורכו.
            </p>
            {approxCount > 0 ? (
              <p className="mt-1 text-ink-faint">
                {approxCount} מקומות אינם קיימים ב-OpenStreetMap בשם הזה,
                ומיקומם כאן משוער עד שיימדד: {approxNames}.
              </p>
            ) : null}
            {!streetLinesAvailable ? null : (
              <p className="mt-1 text-ink-faint">
                שכבת קווי הרחובות העירונית נטענה, ולכן רחוב שיש לו קו מצויר
                כקו ולא כנקודה.
              </p>
            )}
            {basemap === "none" ? (
              <p className="mt-1 text-ink-faint">מפת הרקע לא נטענה. הנתונים על רקע ריק.</p>
            ) : null}
          </div>
        </details>

        {/* גיליון תחתון: נפתח מעל המפה ואינו מזיז אותה. */}
        {sheetOpen ? (
          <div className="map-sheet card" role="dialog" aria-label="פרטים">
            <div className="flex items-start justify-between gap-2 border-b border-line p-3">
              <div>
                <p className="text-[17px] font-semibold text-ink">
                  {quarter ? quarter.name : street?.name}
                </p>
                <p className="text-[13px] text-ink-faint">
                  {quarter
                    ? votesLabel(quarter.votes)
                    : `${votesLabel(street?.votes ?? 0)}${
                        street?.avgScore != null ? ` · ${street.avgScore.toFixed(1)}` : ""
                      }`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedQuarter(null);
                  setSelectedStreet(null);
                }}
                className="min-h-0 rounded-[8px] border border-line px-3 py-1 text-[13px] text-ink"
              >
                סגירה
              </button>
            </div>

            <div className="max-h-[38vh] overflow-y-auto p-3">
              {street ? (
                <Link
                  href={`/street/${street.id}`}
                  className="flex items-center justify-center rounded-[12px] bg-accent px-4 py-3 text-[15px] font-medium text-white"
                >
                  לכרטיס הרחוב
                </Link>
              ) : quarterStreets.length === 0 ? (
                <p className="text-[14px] text-ink-soft">
                  אין עדיין רחובות מדורגים ברובע הזה.
                </p>
              ) : (
                <ul className="grid gap-1">
                  {quarterStreets.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/street/${s.id}`}
                        className="flex items-center justify-between gap-2 rounded-[10px] px-2 py-2 text-[15px] text-ink"
                      >
                        <span>{s.name}</span>
                        <span className="text-[14px] tabular-nums text-ink-faint">
                          {votesLabel(s.votes)}
                          {s.avgScore === null ? "" : ` · ${s.avgScore.toFixed(1)}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {quarter ? (
                <p className="mt-2 text-[13px]">
                  <Link
                    href={`/streets?quarter=${quarter.id}&minVotes=0`}
                    className="inline-link text-accent underline underline-offset-2"
                  >
                    כל הרחובות ב{quarter.name}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* מתחת למפה, לא עליה: רובעים שאין להם עדיין מיקום אמיתי. */}
      {unplaced.length > 0 ? (
        <div className="card mt-3 p-3">
          <p className="text-[15px] font-medium text-ink">
            {unplaced.length} רובעים עדיין בלי מיקום על המפה
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">
            הם אינם מצוירים, כי מיקום משוער שנראה כמו מיקום אמיתי הוא מידע שגוי.
            הם יופיעו ברגע שהצוות ימקם אותם, או כששכבת ה-GIS העירונית תיטען.
          </p>
          <p className="mt-2 text-[13px] text-ink-faint">
            {unplaced.map((q) => q.name).join(" · ")}
          </p>
        </div>
      ) : null}

      {canCalibrate ? (
        <div className="card mt-3 p-3">
          <p className="text-[15px] font-semibold text-ink">מיקום רחובות מ-OpenStreetMap</p>
          <p className="mb-2 text-[13px] text-ink-soft">
            רחוב חדש שקיבל קול מגיע בלי מיקום. הכפתור מחפש כל רחוב כזה
            ב-OpenStreetMap לפי שמו ולפי אשדוד, ושומר את הנקודה. רחוב שלא נמצא
            נשאר בלי מיקום ואינו מצויר — ולא מקבל ניחוש.
          </p>
          <button
            type="button"
            onClick={runGeocode}
            disabled={geocoding}
            className="pressable rounded-[12px] border border-line bg-surface px-4 py-2 text-[14px] text-ink disabled:opacity-50"
          >
            {geocoding ? "מחפש…" : "למקם רחובות חסרים"}
          </button>
          {geocodeMessage ? (
            <p role="status" className="mt-2 text-[13px] text-ink-soft">
              {geocodeMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {canCalibrate ? (
        <div className="card mt-3 p-3">
          <p className="text-[15px] font-semibold text-ink">מיקום ידני על המפה (צוות)</p>
          <p className="mb-2 text-[13px] text-ink-soft">
            בחרו רחוב או רובע, ואז לחצו על המפה במקום שבו הוא נמצא בפועל.
            מאותו רגע הוא מצויר שם. כך ממקמים גם מה שהחיפוש האוטומטי לא מצא.
          </p>

          <div className="mb-2 flex gap-2" role="group" aria-label="מה ממקמים">
            {(
              [
                ["street", "רחוב"],
                ["quarter", "רובע"],
              ] as ["street" | "quarter", string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={placing === value}
                onClick={() => {
                  setPlacing(value);
                  setCalibrating("");
                  calibratingRef.current = "";
                }}
                className={`pressable flex-1 rounded-[10px] px-3 py-2 text-[14px] ${
                  placing === value
                    ? "bg-accent font-semibold text-white"
                    : "border border-line bg-surface text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={calibrating}
            onChange={(e) => setCalibrating(e.target.value)}
            aria-label={placing === "street" ? "הרחוב שממקמים" : "הרובע שממקמים"}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
          >
            <option value="">
              {placing === "street" ? "בחרו רחוב למיקום" : "בחרו רובע למיקום"}
            </option>
            {placing === "street"
              ? [...streets]
                  .sort((a, b) => Number(Boolean(a.center)) - Number(Boolean(b.center)))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.center ? " — מוקם" : " — טרם מוקם"}
                    </option>
                  ))
              : [
                  ...unplaced.map((q) => ({ ...q, placed: false })),
                  ...quarters.map((q) => ({ id: q.id, name: q.name, placed: true })),
                ].map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                    {q.placed ? " — מוקם" : " — טרם מוקם"}
                  </option>
                ))}
          </select>

          {calibrating ? (
            <p role="status" className="mt-2 text-[13px] text-accent">
              לחצו עכשיו על המפה במקום המדויק.
            </p>
          ) : null}
          {saveMessage ? (
            <p role="status" className="mt-2 text-[13px] text-ink-soft">
              {saveMessage}
            </p>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}
