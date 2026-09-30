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

/** הזום שבו עוברים מתצוגת רובעים לתצוגת רחובות. */
const STREET_ZOOM = 14;

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

  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");
  const [legendOpen, setLegendOpen] = useState(false);

  const [calibrating, setCalibrating] = useState("");
  const calibratingRef = useRef("");
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

  const saveQuarter = useCallback(
    async (quarterId: string, point: [number, number]) => {
      setSaveMessage(null);
      const response = await fetch("/api/admin/quarter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quarterId, center: point }),
      });
      if (response.ok) {
        setSaveMessage("הרובע מוקם במפה.");
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
      if (instance.getSource("quarters")) return;

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
        maxzoom: STREET_ZOOM,
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
          // דעיכה אל תצוגת הרחובות במקום היעלמות פתאומית.
          "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 14, 0],
        },
      });

      if (linedStreets.length > 0) {
        instance.addSource("streets", {
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
          source: "streets",
          minzoom: STREET_ZOOM - 1,
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
            "line-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 14, 0.9],
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
     * תוויות הרובעים הן HTML ולא גליפים של המפה: הדפדפן מסדר עברית נכון
     * בעצמו, והתוויות שורדות גם רקע בלי שרת גליפים.
     */
    function addLabels() {
      labels.current.forEach((m) => m.remove());
      labels.current = quarters.map((quarter) => {
        const el = document.createElement("button");
        el.type = "button";
        el.dir = "rtl";
        el.textContent = quarter.name;
        el.setAttribute("aria-label", `${quarter.name}, ${votesLabel(quarter.votes)}`);
        el.className =
          "rounded-full border border-line bg-surface/90 px-2 py-[2px] text-[12px] font-medium text-ink shadow-sm";
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!calibratingRef.current) {
            setSelectedQuarter(quarter.id);
            setSelectedStreet(null);
          }
        });
        return new maplibregl.Marker({ element: el, offset: [0, -26] })
          .setLngLat(quarter.center)
          .addTo(instance);
      });
    }

    /** התוויות שייכות לתצוגת הרובעים בלבד. */
    function syncLabelVisibility() {
      const visible = instance.getZoom() < STREET_ZOOM;
      for (const marker of labels.current) {
        marker.getElement().style.display = visible ? "" : "none";
      }
    }

    instance.on("load", () => {
      if (!usedFallback) setBasemap("ready");
      addData();
      addLabels();
      syncLabelVisibility();
    });
    instance.on("zoomend", syncLabelVisibility);

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
          syncLabelVisibility();
        });
      }
    });

    instance.on("click", (event) => {
      const quarterId = calibratingRef.current;
      if (!quarterId) return;
      void saveQuarter(quarterId, [event.lngLat.lng, event.lngLat.lat]);
    });

    return () => {
      labels.current.forEach((m) => m.remove());
      labels.current = [];
      instance.remove();
      map.current = null;
    };
  }, [center, zoom, quarters, linedStreets, maxQuarterVotes, maxStreetVotes, saveQuarter]);

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
      <div className="map-canvas-wrap">
        <div
          ref={container}
          role="application"
          aria-label="מפת אשדוד"
          className="map-canvas"
        />

        {/* אין מה לצייר: נאמר במפורש, במקום להשאיר רקע ריק בלי הסבר. */}
        {quarters.length === 0 ? (
          <div className="map-empty card">
            <p className="text-[15px] font-medium text-ink">עדיין אין נתונים על המפה</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              אף רובע לא מוקם עדיין במקומו האמיתי, ולכן אין מה לצייר. הרשימה
              והדירוגים עובדים כרגיל במסך הרחובות.
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
            <p>עיגול = רובע. הגודל לפי מספר הקולות, הצבע לפי הציון הממוצע.</p>
            <p className="mt-1">
              הצבעים, מהנמוך לגבוה: גרוע · חלש · בינוני · טוב · מצוין. אפור = אין עדיין ציון.
            </p>
            <p className="mt-1">
              בהתקרבות מעבר לזום {STREET_ZOOM} העיגולים נעלמים ובמקומם מופיעים
              קווי הרחובות, בעובי לפי מספר הקולות.
            </p>
            {!streetLinesAvailable ? (
              <p className="mt-1 text-ink-faint">
                שכבת קווי הרחובות מה-GIS העירוני עדיין לא נטענה, ולכן בהתקרבות
                לא יופיעו קווים.
              </p>
            ) : null}
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
          <p className="text-[15px] font-medium text-ink">מיקום רובעים (צוות)</p>
          <p className="mb-2 text-[13px] text-ink-soft">
            בחרו רובע ולחצו על המפה במקום שבו הוא נמצא בפועל. מאותו רגע הוא
            מצויר שם, ונספר בתצוגה.
          </p>
          <select
            value={calibrating}
            onChange={(e) => setCalibrating(e.target.value)}
            aria-label="הרובע שממקמים"
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
          >
            <option value="">בחרו רובע למיקום</option>
            {[...unplaced.map((q) => ({ ...q, placed: false })),
              ...quarters.map((q) => ({ id: q.id, name: q.name, placed: true }))].map((q) => (
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
