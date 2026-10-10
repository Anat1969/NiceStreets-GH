"use client";

/**
 * מפת רובעים: צביעה לפי מדד, בחירה בלחיצה, ורשימה מדורגת שמסונכרנת איתה.
 *
 * הרכיב אינו יודע על אשדוד דבר. הוא מקבל קובץ גבולות שבו כל פוליגון מזוהה
 * בשדה אחד (`idProperty`), ונתונים לפי אותו מזהה — כאובייקט מוכן (`data`)
 * או כמקור שיודע לטעון (`source`). ראו lib/districts.ts.
 *
 * התנהגות:
 *   צבע    — לפי רבעוני המדד הנבחר, בסולם בגוון אחד.
 *   ריחוף  — הדגשת הגבול וחלונית עם השם והערך (במחשב בלבד).
 *   לחיצה  — בחירה, טיסה לגבולות הרובע, ולוח עם כל השדות שלו.
 *   רקע    — לחיצה מחוץ לרובע מנקה את הבחירה.
 *   רשימה  — מדורגת לפי המדד; בחירה בה ובמפה היא אותה בחירה.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  NO_DATA_COLOR,
  classColors,
  classRanges,
  classify,
  featureBounds,
  featureCentroid,
  formatMetric,
  quartileBreaks,
  textOnClass,
  unionBounds,
  type DistrictData,
  type DistrictDataSource,
  type MetricDef,
} from "@/lib/districts";
import { BLANK_STYLE, ensureRtlTextPlugin, mapStyleUrl } from "@/lib/map-style";

interface Props {
  /** כתובת קובץ הגבולות (GeoJSON FeatureCollection של פוליגונים). */
  geojsonUrl: string;
  idProperty?: string;
  nameProperty?: string;
  centroidLatProperty?: string;
  centroidLonProperty?: string;
  /** נתונים מוכנים. או זה, או `source`. */
  data?: DistrictData;
  /** מקור שיודע לטעון נתונים. נוצר בצד הלקוח בלבד. */
  source?: DistrictDataSource;
  metrics: MetricDef[];
  initialMetric?: string;
  center: [number, number];
  zoom: number;
}

interface DistrictRow {
  id: string;
  name: string;
  /** השם על המפה: מקובץ הגבולות, שבו השמות קצרים ("סיטי", "מרינה"). */
  mapLabel: string;
  /** null = אין לו גבול בקובץ, ולכן אינו מצויר. */
  bounds: [[number, number], [number, number]] | null;
  centroid: [number, number] | null;
  value: number | null;
  cls: number | null;
  color: string;
  hasRecord: boolean;
}

const FILL = "district-fill";
const OUTLINE = "district-outline";
const SOURCE = "districts";

/** "רובע י\"א" → "י\"א": על המפה אין מקום לשם המלא. */
function shortName(name: string): string {
  return name.replace(/^רובע\s+/, "");
}

export default function DistrictMap({
  geojsonUrl,
  idProperty = "rova_code",
  nameProperty = "name_he",
  centroidLatProperty = "centroid_lat",
  centroidLonProperty = "centroid_lon",
  data,
  source,
  metrics,
  initialMetric,
  center,
  zoom,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLOListElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const labels = useRef<maplibregl.Marker[]>([]);
  const popup = useRef<maplibregl.Popup | null>(null);

  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<DistrictData | null>(data ?? null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [metricKey, setMetricKey] = useState(initialMetric ?? metrics[0]?.key ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");

  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const records = useMemo(() => data ?? loaded ?? {}, [data, loaded]);

  /* ---------------------------------------------------------- טעינה */

  useEffect(() => {
    let cancelled = false;
    fetch(geojsonUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`קובץ הגבולות לא נטען (${r.status})`);
        return r.json();
      })
      .then((parsed: GeoJSON.FeatureCollection) => {
        if (cancelled) return;
        if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
          throw new Error("קובץ הגבולות אינו GeoJSON תקין");
        }
        setGeo(parsed);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGeoError(error instanceof Error ? error.message : "קובץ הגבולות לא נטען");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [geojsonUrl]);

  useEffect(() => {
    if (data || !source) return;
    let cancelled = false;
    source
      .load()
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDataError(error instanceof Error ? error.message : "הנתונים לא נטענו");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [data, source]);

  /* ---------------------------------------------------------- שורות */

  const { rows, breaks, colors } = useMemo(() => {
    const features = geo?.features ?? [];
    const seen = new Set<string>();
    const base: Omit<DistrictRow, "cls" | "color">[] = [];

    for (const feature of features) {
      const id = String(feature.properties?.[idProperty] ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const record = records[id];
      base.push({
        id,
        name: record?.name ?? String(feature.properties?.[nameProperty] ?? id),
        mapLabel: shortName(String(feature.properties?.[nameProperty] ?? record?.name ?? id)),
        bounds: featureBounds(feature.geometry),
        centroid: featureCentroid(feature, centroidLatProperty, centroidLonProperty),
        value: record?.values[metric?.key ?? ""] ?? null,
        hasRecord: Boolean(record),
      });
    }
    // רובע שיש לו נתונים ואין לו גבול: ברשימה, לא על המפה.
    for (const [id, record] of Object.entries(records)) {
      if (seen.has(id)) continue;
      base.push({
        id,
        name: record.name ?? id,
        mapLabel: shortName(record.name ?? id),
        bounds: null,
        centroid: null,
        value: record.values[metric?.key ?? ""] ?? null,
        hasRecord: true,
      });
    }

    const cuts = quartileBreaks(base.map((r) => r.value));
    const palette = classColors(cuts.length + 1);
    const withClass: DistrictRow[] = base.map((r) => {
      const cls = classify(r.value, cuts);
      return { ...r, cls, color: cls === null ? NO_DATA_COLOR : palette[cls] };
    });

    const direction = metric?.higherIsBetter === false ? 1 : -1;
    withClass.sort((a, b) => {
      // קודם מי שיש לו ערך, אחר כך מי שאין, ובסוף מי שאין לו גבול.
      if ((a.value === null) !== (b.value === null)) return a.value === null ? 1 : -1;
      if (a.value !== null && b.value !== null && a.value !== b.value) {
        return direction * (a.value - b.value);
      }
      if ((a.bounds === null) !== (b.bounds === null)) return a.bounds === null ? 1 : -1;
      return a.name.localeCompare(b.name, "he");
    });

    return { rows: withClass, breaks: cuts, colors: palette };
  }, [geo, records, metric, idProperty, nameProperty, centroidLatProperty, centroidLonProperty]);

  const ranges = useMemo(
    () => classRanges(rows.map((r) => r.value), breaks),
    [rows, breaks],
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const metricRef = useRef(metric);
  metricRef.current = metric;

  /* ---------------------------------------------------------- בחירה */

  /*
   * הטיסה קורית אחרי שהלוח צויר, כדי למדוד אותו: הלוח מכסה חלק מהמפה —
   * בנייד את התחתית, במחשב את הצד — והרובע צריך להיכנס במה שנשאר גלוי.
   */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady || !selected) return;
    const row = rowsRef.current.find((r) => r.id === selected);
    if (!row?.bounds) return;
    const box = wrap.current;
    const sheet = panel.current;
    const width = box?.clientWidth ?? 0;
    const height = box?.clientHeight ?? 0;
    const wide = width >= 720;
    const covered = sheet ? (wide ? sheet.offsetWidth : sheet.offsetHeight) + 16 : 0;
    // ריפוד שגדול מהמפה עצמה גורם ל-fitBounds לוותר בשקט.
    const safe = (value: number, size: number) => Math.max(16, Math.min(value, size - 80));
    instance.fitBounds(row.bounds, {
      padding: wide
        ? { top: 40, bottom: 40, left: 40, right: safe(covered + 24, width) }
        : { top: 24, bottom: safe(covered + 12, height), left: 24, right: 24 },
      maxZoom: 15,
      duration: 700,
    });
  }, [selected, mapReady]);

  const select = useCallback((id: string | null, from: "map" | "list") => {
    setSelected(id);
    if (from === "list" && id) {
      wrap.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);
  const selectRef = useRef(select);
  selectRef.current = select;

  // הבחירה במפה מסמנת את השורה, וגוללת אליה בתוך הרשימה בלבד — לא את העמוד.
  useEffect(() => {
    if (!selected || !listBox.current) return;
    const row = listBox.current.querySelector<HTMLElement>(`[data-id="${CSS.escape(selected)}"]`);
    if (!row) return;
    const box = listBox.current;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: top - 8, behavior: "smooth" });
    }
  }, [selected]);

  /* ---------------------------------------------------------- המפה */

  // נוצרת פעם אחת, כשהגבולות הגיעו. צבע ובחירה מתעדכנים בלי לבנות אותה מחדש.
  useEffect(() => {
    if (!container.current || !geo) return;

    let instance: MapLibreMap;
    try {
      ensureRtlTextPlugin();
      instance = new maplibregl.Map({
        container: container.current,
        style: mapStyleUrl(),
        center,
        zoom,
        attributionControl: { compact: true },
      });
    } catch {
      // בלי WebGL אין מפה, אבל הרשימה המדורגת ממשיכה לעבוד.
      setBasemap("none");
      return;
    }
    map.current = instance;
    instance.dragRotate.disable();
    instance.touchZoomRotate.disableRotation();

    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container.current);

    const canHover =
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
    let hovered: string | null = null;
    let usedFallback = false;

    function addLayers() {
      if (instance.getSource(SOURCE)) return;
      instance.addSource(SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        promoteId: "__id",
      });
      instance.addLayer({
        id: FILL,
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": ["coalesce", ["get", "__color"], NO_DATA_COLOR],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.88,
            0.72,
          ],
        },
      });
      instance.addLayer({
        id: OUTLINE,
        type: "line",
        source: SOURCE,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#16202b",
            "#ffffff",
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            ["boolean", ["feature-state", "hover"], false],
            2.5,
            1.2,
          ],
        },
      });
      setMapReady(true);
    }

    instance.on("load", () => {
      setBasemap((b) => (b === "none" ? b : "ready"));
      addLayers();
    });

    instance.on("error", (event) => {
      const message = String(event?.error?.message ?? "");
      const styleFailed = !instance.isStyleLoaded() || message.includes("style");
      if (styleFailed && !usedFallback) {
        usedFallback = true;
        setBasemap("none");
        setMapReady(false);
        instance.setStyle(BLANK_STYLE);
        instance.once("styledata", addLayers);
      }
    });

    instance.on("click", (event) => {
      const hit = instance.getLayer(FILL)
        ? instance.queryRenderedFeatures(event.point, { layers: [FILL] })
        : [];
      const id = hit[0]?.properties?.__id as string | undefined;
      selectRef.current(id ?? null, "map");
    });

    if (canHover) {
      popup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "district-tooltip",
        offset: 12,
      });

      instance.on("mousemove", FILL, (event) => {
        const id = event.features?.[0]?.properties?.__id as string | undefined;
        if (!id) return;
        instance.getCanvas().style.cursor = "pointer";
        if (hovered !== id) {
          if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
          hovered = id;
          instance.setFeatureState({ source: SOURCE, id }, { hover: true });
        }
        const row = rowsRef.current.find((r) => r.id === id);
        const current = metricRef.current;
        if (!row || !current) return;
        const element = document.createElement("div");
        element.className = "district-tooltip-body";
        const title = document.createElement("strong");
        title.textContent = row.name;
        const value = document.createElement("span");
        value.textContent = `${current.label}: ${formatMetric(row.value, current)}`;
        element.append(title, value);
        popup.current?.setLngLat(event.lngLat).setDOMContent(element).addTo(instance);
      });

      instance.on("mouseleave", FILL, () => {
        instance.getCanvas().style.cursor = "";
        if (hovered) instance.setFeatureState({ source: SOURCE, id: hovered }, { hover: false });
        hovered = null;
        popup.current?.remove();
      });
    }

    return () => {
      resizeObserver.disconnect();
      labels.current.forEach((m) => m.remove());
      labels.current = [];
      popup.current?.remove();
      popup.current = null;
      instance.remove();
      map.current = null;
      setMapReady(false);
    };
  }, [geo, center, zoom]);

  // הנתונים על המפה: צבע לכל פוליגון ותווית במרכזו.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady || !geo) return;

    const byId = new Map(rows.map((r) => [r.id, r]));
    const features: GeoJSON.Feature[] = [];
    for (const feature of geo.features) {
      const id = String(feature.properties?.[idProperty] ?? "").trim();
      const row = byId.get(id);
      if (!row || !feature.geometry) continue;
      features.push({
        type: "Feature",
        geometry: feature.geometry,
        properties: { __id: id, __color: row.color },
      });
    }
    const src = instance.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features });

    labels.current.forEach((m) => m.remove());
    labels.current = [];
    for (const row of rows) {
      if (!row.centroid || !metric) continue;
      const element = document.createElement("div");
      element.className = "district-label";
      element.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "district-label-name";
      name.textContent = row.mapLabel;
      element.append(name);
      if (row.value !== null) {
        const value = document.createElement("span");
        value.className = "district-label-value";
        value.textContent = row.value.toFixed(metric.decimals ?? 1);
        element.append(value);
      }
      labels.current.push(
        new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat(row.centroid)
          .addTo(instance),
      );
    }
  }, [rows, mapReady, geo, idProperty, metric]);

  // התאמה ראשונה לגבולות כל הרובעים.
  const fitted = useRef(false);
  useEffect(() => {
    if (!mapReady || fitted.current || rows.length === 0) return;
    const all = unionBounds(rows.map((r) => r.bounds));
    if (all && map.current) {
      fitted.current = true;
      map.current.fitBounds(all, { padding: 24, duration: 0 });
    }
  }, [mapReady, rows]);

  // הבחירה על המפה.
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !mapReady) return;
    if (previous.current && previous.current !== selected) {
      instance.setFeatureState({ source: SOURCE, id: previous.current }, { selected: false });
    }
    if (selected && rows.some((r) => r.id === selected && r.bounds)) {
      instance.setFeatureState({ source: SOURCE, id: selected }, { selected: true });
    }
    previous.current = selected;
  }, [selected, mapReady, rows]);

  /* ---------------------------------------------------------- תצוגה */

  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const selectedRecord = selected ? records[selected] : undefined;
  const rankOf = new Map(
    rows.filter((r) => r.value !== null).map((r, index) => [r.id, index + 1]),
  );
  const withValue = rankOf.size;

  return (
    <div className="district-map">
      {metrics.length > 1 ? (
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="לפי מה לצבוע">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metric?.key}
              onClick={() => setMetricKey(m.key)}
              className={`pressable flex-1 rounded-[12px] px-3 py-2 text-[14px] ${
                m.key === metric?.key
                  ? "bg-accent font-semibold text-white"
                  : "border border-line bg-surface text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={wrap} className="map-canvas-wrap district-canvas-wrap">
        <div ref={container} className="map-canvas" />

        {geoError ? (
          <div className="map-empty card" role="alert">
            <p className="text-[14px] text-ink">גבולות הרובעים לא נטענו.</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              {geoError}. הדירוג שמתחת למפה עדיין מעודכן.
            </p>
          </div>
        ) : basemap === "none" ? (
          <p className="district-notice">מפת הרקע לא נטענה. הגבולות מוצגים בלעדיה.</p>
        ) : null}

        {/* לוח הפרטים: גיליון תחתון בנייד, לוח צד במחשב. */}
        {selectedRow ? (
          <div
            ref={panel}
            className="district-panel card"
            role="dialog"
            aria-label={`פרטי ${selectedRow.name}`}
          >
            <div className="flex items-start justify-between gap-2 border-b border-line p-3">
              <div>
                <p className="text-[17px] font-semibold text-ink">{selectedRow.name}</p>
                <p className="text-[13px] text-ink-faint">
                  {rankOf.has(selectedRow.id)
                    ? `מקום ${rankOf.get(selectedRow.id)} מתוך ${withValue}`
                    : "עדיין לא דורג"}
                  {selectedRow.bounds || !geo ? "" : " · אין גבול במפה"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => select(null, "map")}
                className="pressable rounded-[10px] border border-line px-3 text-[14px] text-ink"
              >
                סגירה
              </button>
            </div>

            <div className="district-panel-body p-3">
              <dl className="district-fields">
                {metrics.map((m) => (
                  <div key={m.key}>
                    <dt>{m.label}</dt>
                    <dd className="tabular-nums">
                      {formatMetric(selectedRecord?.values[m.key], m)}
                    </dd>
                  </div>
                ))}
                {selectedRecord?.fields?.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd className="tabular-nums">{f.value}</dd>
                  </div>
                ))}
              </dl>

              {!selectedRecord ? (
                <p className="mt-2 text-[14px] text-ink-soft">
                  אין נתונים על האזור הזה באפליקציה.
                </p>
              ) : null}

              {selectedRecord?.items && selectedRecord.items.length > 0 ? (
                <>
                  {selectedRecord.itemsTitle ? (
                    <p className="mt-3 mb-1 text-[14px] font-semibold text-ink">
                      {selectedRecord.itemsTitle}
                    </p>
                  ) : null}
                  <ul className="grid gap-1">
                    {selectedRecord.items.map((item) => (
                      <li key={`${item.label}-${item.href ?? ""}`}>
                        {item.href ? (
                          <Link href={item.href} className="district-item">
                            <span>{item.label}</span>
                            {item.detail ? (
                              <span className="text-[13px] tabular-nums text-ink-faint">
                                {item.detail}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          <span className="district-item">
                            <span>{item.label}</span>
                            {item.detail ? (
                              <span className="text-[13px] tabular-nums text-ink-faint">
                                {item.detail}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {selectedRecord?.link ? (
                <p className="mt-2 text-[14px]">
                  <Link
                    href={selectedRecord.link.href}
                    className="inline-link text-accent underline underline-offset-2"
                  >
                    {selectedRecord.link.label}
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* מקרא מתחת למפה ולא עליה: כך הוא אינו מסתיר אף רובע. */}
      {metric && ranges.length > 0 ? (
        <div className="district-legend" aria-label="מקרא">
          <p className="district-legend-title">
            {metric.label}
            {ranges.length > 1 ? " · לפי רבעונים" : ""}
          </p>
          <ul>
            {[...ranges].reverse().map((range) => {
              const color = colors[range.cls];
              return (
                <li key={range.cls}>
                  <span className="district-swatch" style={{ background: color }} />
                  <span className="tabular-nums" dir="ltr">
                    {range.min === range.max
                      ? range.min.toFixed(metric.decimals ?? 1)
                      : `${range.min.toFixed(metric.decimals ?? 1)}–${range.max.toFixed(
                          metric.decimals ?? 1,
                        )}`}
                  </span>
                </li>
              );
            })}
            <li>
              <span className="district-swatch" style={{ background: NO_DATA_COLOR }} />
              <span>אין נתונים</span>
            </li>
          </ul>
        </div>
      ) : null}

      {dataError ? (
        <p role="alert" className="mt-2 text-[14px] text-warm">
          הנתונים לא נטענו: {dataError}
        </p>
      ) : null}

      {/* הדירוג: אותה בחירה כמו במפה, וגם החלופה הנגישה לה. */}
      {rows.length > 0 && metric ? (
        <section className="mt-3" aria-label={`דירוג לפי ${metric.label}`}>
          <h2 className="mb-1 text-[17px] font-semibold text-ink">
            דירוג הרובעים לפי {metric.label}
          </h2>
          <ol ref={listBox} className="district-rank">
            {rows.map((row) => {
              const rank = rankOf.get(row.id);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    data-id={row.id}
                    aria-pressed={row.id === selected}
                    onClick={() => select(row.id === selected ? null : row.id, "list")}
                    className="district-rank-row pressable"
                  >
                    <span
                      className="district-rank-num tabular-nums"
                      style={{ background: row.color, color: textOnClass(row.color) }}
                    >
                      {rank ?? "–"}
                    </span>
                    <span className="flex-1 text-right">
                      {row.name}
                      {row.bounds || !geo ? null : (
                        <span className="block text-[12px] text-ink-faint">אין גבול במפה</span>
                      )}
                    </span>
                    <span className="text-[14px] tabular-nums text-ink-soft">
                      {formatMetric(row.value, metric)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
