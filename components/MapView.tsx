"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { votesLabel } from "@/lib/hebrew";
import { normaliseForSearch } from "@/lib/street-filter";
import { scoreOutOfTen } from "@/lib/score";
import { classRanges, classify, voteLevels } from "@/lib/districts";
import { useBrandColor } from "@/lib/use-brand-color";
import { BLANK_STYLE, ensureRtlTextPlugin, mapStyleUrl } from "@/lib/map-style";

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
  /**
   * נעילה לתצוגת רחובות. מפת הרובעים עברה לרכיב משלה (DistrictMap), ולכן
   * לתושב אין כאן מתג. הצוות מקבל את מצב הנקודות לכיול אזורים בלי גבול.
   */
  lockMode?: "street";
}

/**
 * הסימן על המפה: גוון המותג שנבחר בכותרת, בעוצמה לפי דרגת הקולות — אותה
 * שפה כמו במפת הרובעים. הרקע חצי שקוף, כך שהמפה נראית מתחת גם לכהה ביותר.
 */
function markFill(level: number | null, levels: number): string {
  const percent = level === null ? 8 : Math.round(18 + (40 * level) / Math.max(1, levels - 1));
  return `color-mix(in srgb, var(--brand-500) ${percent}%, rgb(255 255 255 / 72%))`;
}

/** קו רחוב (כשיש שכבת GIS): אותו גוון, אטום יותר כי קו דק מכתם. */
function lineOpacity(level: number | null, levels: number): number {
  if (level === null) return 0.3;
  return 0.4 + (0.5 * level) / Math.max(1, levels - 1);
}

export default function MapView({
  center,
  zoom,
  quarters,
  unplaced,
  streets,
  streetLinesAvailable,
  canCalibrate = false,
  lockMode,
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
  const [mode, setMode] = useState<"quarter" | "street">(lockMode ?? "quarter");
  /*
   * הרובע שנבחר בתצוגת רובעים. בחירה בו מתקרבת אליו ומוסיפה את
   * הרחובות שבתוכו — במקום שכל רחובות העיר יצוירו כל הזמן.
   */
  const [focusQuarter, setFocusQuarter] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");

  const [search, setSearch] = useState("");
  /** נקרא מתוך האפקט של המפה, כדי שהחיפוש יוכל להטיס אליה. */
  const focusStreetRef = useRef<(id: string) => void>(() => {});
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

  /*
   * דרגות הקולות: שלוש, לפי שלישים — אותו כלל כמו במפת הרובעים. רובעים
   * ורחובות מדורגים כל אחד מול עצמו, כי סדרי הגודל שלהם שונים.
   */
  const quarterBreaks = useMemo(() => voteLevels(quarters.map((q) => q.votes)), [quarters]);
  const streetBreaks = useMemo(
    () => voteLevels(placedStreets.map((s) => s.votes)),
    [placedStreets],
  );
  const legendBreaks = mode === "quarter" ? quarterBreaks : streetBreaks;
  const legendRanges = useMemo(
    () =>
      classRanges(
        (mode === "quarter" ? quarters : placedStreets)
          .map((x) => x.votes)
          .filter((v) => v > 0),
        legendBreaks,
      ),
    [mode, quarters, placedStreets, legendBreaks],
  );
  const brand = useBrandColor();
  const brandRef = useRef(brand);
  brandRef.current = brand;

  /* מיקום משוער נאמר במפורש במקרא, ולא מוצג כאילו נמדד. */
  const approx = useMemo(
    () => quarters.filter((q) => q.centerSource === "approx"),
    [quarters],
  );
  const approxCount = approx.length;

  const matches = useMemo(() => {
    const needle = normaliseForSearch(search);
    if (!needle) return [];
    return placedStreets.filter((s) => normaliseForSearch(s.name).includes(needle));
  }, [search, placedStreets]);

  function focusStreet(id: string) {
    setMode("street");
    setFocusQuarter(null);
    setSelectedQuarter(null);
    setSelectedStreet(id);
    setSearch("");
    focusStreetRef.current(id);
  }

  const focusedQuarter = focusQuarter
    ? (quarters.find((q) => q.id === focusQuarter) ?? null)
    : null;
  const focusedStreetCount = focusQuarter
    ? placedStreets.filter((s) => s.quarterId === focusQuarter && s.votes > 0).length
    : 0;
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
      style: mapStyleUrl(),
      center,
      zoom,
      attributionControl: { compact: true },
      // מכשיר בינוני: בלי סיבוב ובלי הטיה, פחות ציור ופחות מגע בשוגג.
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.current = instance;
    // למטה־שמאל: הפס העליון של הרובע שבמוקד תופס את הפינה העליונה.
    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-left",
    );
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
        /*
          נקודה שקטה בלבד: "המקום הזה קיים ומוקם". המידע עצמו — כמה
          קולות ומה הציון — נמצא בדיסקית שמעליה, ואין טעם לקודד אותו
          פעמיים בשני אלמנטים שמתחרים זה בזה.
        */
        paint: {
          "circle-radius": 4,
          "circle-color": "#8a97a5",
          "circle-opacity": 0.55,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.8,
        },
      });

      instance.on("click", "quarter-circles", (event) => {
        if (calibratingRef.current) return;
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) selectQuarter(id);
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
              properties: {
                id: s.id,
                name: s.name,
                votes: s.votes,
                opacity: lineOpacity(classify(s.votes || null, streetBreaks), streetBreaks.length + 1),
              },
            })),
          },
        });
        instance.addLayer({
          id: "street-lines",
          type: "line",
          source: "street-lines-src",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": brandRef.current,
            "line-width": [
              "interpolate",
              ["linear"],
              ["sqrt", ["get", "votes"]],
              0, 3,
              Math.sqrt(maxStreetVotes), 12,
            ],
            "line-opacity": ["get", "opacity"],
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
            },
          })),
        },
      });

      instance.addLayer({
        id: "street-circles",
        type: "circle",
        source: "street-points",
        paint: {
          "circle-radius": 4,
          "circle-color": "#8a97a5",
          "circle-opacity": 0.55,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.8,
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
    /**
     * סימן אחד שנושא את כל המידע.
     *
     * קודם לכן היו שני אלמנטים על כל מקום: עיגול שצבעו הציון וגודלו
     * מספר הקולות, ולידו אליפסה עם השם והמספר. שניים כאלה על 22 מקומות
     * כיסו את העיר ולא אמרו יותר מאחד. כאן יש דיסקית אחת:
     *   הקוטר  = מספר הקולות (שורש, כדי שהיחס ייראה ולא יתפוצץ)
     *   הצבע   = הציון הממוצע, על רצף
     *   המספר בתוכה = מספר הקולות, כדי שלא צריך להקיש כדי לדעת
     *   השם מתחתיה = טקסט עם הילה לבנה, בלי מסגרת ובלי רקע
     */
    function selectQuarter(quarterId: string) {
      /*
       * הקשה על רובע מתקרבת אליו ומוסיפה את רחובותיו למפה. גיליון
       * שהיה נפתח כאן היה מכסה בדיוק את מה שהרגע נחשף.
       */
      setSelectedQuarter(null);
      setSelectedStreet(null);
      setFocusQuarter(quarterId);
      flyToQuarter(quarterId, 700);
    }

    /**
     * זום לתחום הרובע, לא לזום קבוע.
     *
     * רובע עם ארבעה רחובות פזורים ורובע עם שניים צמודים אינם צריכים
     * אותו זום. התחום נבנה ממרכז הרובע ומכל רחובותיו, כך שכולם נכנסים
     * למסך ואף אחד לא נחתך.
     */
    function flyToQuarter(quarterId: string, duration: number) {
      const quarter = quarters.find((q) => q.id === quarterId);
      if (!quarter) return;
      const own = placedStreets.filter((s) => s.quarterId === quarterId);
      const points = [quarter.center, ...own.map((s) => streetPoint(s))];
      if (points.length < 2) {
        instance.flyTo({ center: quarter.center, zoom: 15, duration });
        return;
      }
      const bounds = points.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(points[0], points[0]),
      );
      /*
       * ריפוד לא סימטרי: הפס העליון של הרובע תופס את ראש המפה, והשם
       * של כל סימן נמצא מתחתיו — ולכן צריך מקום נוסף למעלה ולמטה.
       */
      instance.fitBounds(bounds, {
        padding: { top: 100, bottom: 110, left: 56, right: 56 },
        maxZoom: 16,
        duration,
      });
    }

    function addLabels() {
      labels.current.forEach((m) => m.remove());
      const focusedStreets =
        mode === "quarter" && focusQuarter
          ? placedStreets.filter((s) => s.quarterId === focusQuarter && s.votes > 0)
          : [];

      const items =
        mode === "quarter"
          ? [
              ...quarters
                .filter((q) => q.votes > 0)
                .map((q) => ({
                  id: q.id,
                  name: q.name,
                  votes: q.votes,
                  avgScore: q.avgScore,
                  at: q.center,
                  breaks: quarterBreaks,
                  pick: () => selectQuarter(q.id),
                })),
              ...focusedStreets.map((s) => ({
                id: s.id,
                name: s.name,
                votes: s.votes,
                avgScore: s.avgScore,
                at: streetPoint(s),
                breaks: streetBreaks,
                pick: () => {
                  setSelectedStreet(s.id);
                  setSelectedQuarter(null);
                },
              })),
            ]
          : placedStreets
              .filter((s) => s.votes > 0)
              .map((s) => ({
                id: s.id,
                name: s.name,
                votes: s.votes,
                avgScore: s.avgScore,
                at: streetPoint(s),
                breaks: streetBreaks,
                pick: () => {
                  setSelectedStreet(s.id);
                  setSelectedQuarter(null);
                },
              }));

      labels.current = items.map((item) => {
        const levels = item.breaks.length + 1;
        const fill = markFill(classify(item.votes, item.breaks), levels);

        const el = document.createElement("button");
        el.type = "button";
        el.dir = "rtl";
        el.className = "map-mark";
        el.setAttribute(
          "aria-label",
          `${item.name}, ${votesLabel(item.votes)}${
            item.avgScore === null ? "" : `, ציון ${scoreOutOfTen(item.avgScore)} מתוך 10`
          }`,
        );

        const disc = document.createElement("span");
        disc.className = "map-mark-disc";
        disc.style.background = fill;
        // המספר בעיגול הוא הציון, כמו התווית על הרובע. הקולות הם הגוון.
        disc.textContent = item.avgScore === null ? "–" : scoreOutOfTen(item.avgScore);
        disc.setAttribute("aria-hidden", "true");

        const name = document.createElement("span");
        name.className = "map-mark-name";
        name.textContent = item.name;
        name.setAttribute("aria-hidden", "true");

        el.append(disc, name);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!calibratingRef.current) item.pick();
        });

        return new maplibregl.Marker({ element: el })
          .setLngLat(item.at)
          .addTo(instance);
      });
    }

    /** המפה נפתחת על מה שיש עליה, ולא על מרכז קבוע שאולי ריק. */
    function fitToData() {
      /*
       * כשרובע נבחר, המפה כבר ממוקדת בו — התאמה מחדש לכל העיר הייתה
       * מבטלת בדיוק את מה שהמשתמשת ביקשה בלחיצה.
       */
      if (focusQuarter) {
        flyToQuarter(focusQuarter, 0);
        return;
      }
      const points =
        mode === "quarter"
          ? quarters.map((q) => q.center)
          : placedStreets.map((s) => streetPoint(s));
      if (points.length < 2) return;
      const bounds = points.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(points[0], points[0]),
      );
      instance.fitBounds(bounds, {
        padding: { top: 56, bottom: 72, left: 48, right: 48 },
        maxZoom: 15,
        duration: 0,
      });
    }

    /*
     * המפה מודדת את עצמה פעם אחת בעת היצירה. אם המסגרת עוד לא קיבלה
     * את גובהה הסופי באותו רגע, הקנבס נשאר בגודל השגוי לתמיד. המשקיף
     * הזה מיישר אותו בכל שינוי גודל — כולל סיבוב מכשיר.
     */
    const resizeObserver = new ResizeObserver(() => instance.resize());
    if (container.current) resizeObserver.observe(container.current);

    /* החיפוש שמחוץ למפה מטיס אליה דרך הפניה הזאת. */
    focusStreetRef.current = (streetId: string) => {
      const target = placedStreets.find((s) => s.id === streetId);
      if (target) {
        instance.flyTo({ center: streetPoint(target), zoom: 16, duration: 700 });
      }
    };

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
    focusQuarter,
    quarters,
    linedStreets,
    placedStreets,
    streetPoint,
    maxQuarterVotes,
    maxStreetVotes,
    quarterBreaks,
    streetBreaks,
    saveQuarter,
  ]);

  // צבע אחר בכותרת: הסימנים מתעדכנים לבד (משתנה CSS); קווי הרחובות כאן.
  useEffect(() => {
    const instance = map.current;
    if (instance?.getLayer("street-lines")) {
      instance.setPaintProperty("street-lines", "line-color", brand);
    }
  }, [brand]);

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
        hidden={lockMode !== undefined}
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
              setFocusQuarter(null);
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

      {/*
        חיפוש רחוב: מי שיודע איזה רחוב הוא מחפש לא אמור לסרוק את המפה.
        התוצאה הראשונה נבחרת, המפה טסה אליה, והגיליון נפתח עם קישור
        לכרטיס המלא.
      */}
      <div className="mb-2">
        <label className="sr-only" htmlFor="map-search">
          חיפוש רחוב במפה
        </label>
        <input
          id="map-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש רחוב במפה"
          autoComplete="off"
          className="w-full rounded-[12px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
        />
        {search.trim() && matches.length > 0 ? (
          <ul className="mt-1 grid gap-1">
            {matches.slice(0, 6).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => focusStreet(m.id)}
                  className="pressable w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-right text-[14px] text-ink"
                >
                  {m.name}
                  <span className="text-[13px] text-ink-faint">
                    {" · "}
                    {votesLabel(m.votes)}
                    {m.avgScore === null ? "" : ` · ${scoreOutOfTen(m.avgScore)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {search.trim() && matches.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-faint">
            לא נמצא רחוב מוקם בשם הזה. ייתכן שהוא עדיין בלי מיקום על המפה.
          </p>
        ) : null}
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


        {/*
          פס דק בראש המפה כשרובע במוקד: אומר איפה אנחנו ומחזיר החוצה,
          בלי לכסות את הרחובות שהרגע נחשפו.
        */}
        {focusedQuarter ? (
          <div className="map-focus-bar card">
            <span className="text-[14px] font-semibold text-ink">
              {focusedQuarter.name}
            </span>
            <span className="text-[13px] text-ink-faint">
              {focusedStreetCount === 0
                ? "אין בו רחובות מדורגים"
                : `${focusedStreetCount} ${
                    focusedStreetCount === 1 ? "רחוב מדורג" : "רחובות מדורגים"
                  }`}
            </span>
            <button
              type="button"
              onClick={() => {
                setFocusQuarter(null);
                setSelectedQuarter(null);
                setSelectedStreet(null);
              }}
              className="pressable min-h-0 rounded-full border border-line px-3 py-1 text-[13px] text-ink"
            >
              חזרה לכל העיר
            </button>
          </div>
        ) : null}

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
                        street?.avgScore != null
                          ? ` · ציון ${scoreOutOfTen(street.avgScore)} מתוך 10`
                          : ""
                      }`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedQuarter(null);
                  setSelectedStreet(null);
                  setFocusQuarter(null);
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
                          {s.avgScore === null ? "" : ` · ${scoreOutOfTen(s.avgScore)}`}
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

      {/*
        מקרא מתחת למפה ולא עליה, באותה שפה כמו במפת הרובעים: שורה אחת קטנה.
        קודם הוא ישב על המפה, וכלל CSS שבור הסתיר אותו תמיד.
      */}
      {legendRanges.length > 0 ? (
        <div className="district-legend" aria-label="מקרא">
          <span className="district-legend-title">גוון לפי מספר הקולות:</span>
          <ul>
            {legendRanges.map((range) => (
              <li key={range.cls}>
                <span
                  className="district-swatch"
                  style={{ background: markFill(range.cls, legendBreaks.length + 1) }}
                />
                <span className="tabular-nums" dir="ltr">
                  {range.min === range.max ? range.min : `${range.min}–${range.max}`}
                </span>
              </li>
            ))}
          </ul>
          <span>· המספר בעיגול: ציון ממוצע מתוך 10</span>
          {streetLinesAvailable && mode === "street" ? (
            <span>· רחוב עם קו מה-GIS העירוני מצויר כקו</span>
          ) : null}
        </div>
      ) : null}
      {approxCount > 0 || basemap === "none" ? (
        <p className="mt-1 text-[12px] text-ink-faint">
          {approxCount > 0
            ? `${approxCount} מקומות אינם קיימים ב-OpenStreetMap בשם הזה, ומיקומם משוער עד שיימדד: ${approxNames}. `
            : ""}
          {basemap === "none" ? "מפת הרקע לא נטענה. הנתונים על רקע ריק." : ""}
        </p>
      ) : null}

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
