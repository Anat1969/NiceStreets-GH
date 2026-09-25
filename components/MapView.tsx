"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { votesLabel } from "@/lib/hebrew";

interface QuarterFeature {
  id: string;
  name: string;
  polygon: [number, number][];
  center: [number, number];
  schematic: boolean;
  votes: number;
  avgScore: number | null;
}

interface StreetFeature {
  id: string;
  name: string;
  quarterId: string;
  votes: number;
  avgScore: number | null;
}

interface Props {
  center: [number, number];
  zoom: number;
  quarters: QuarterFeature[];
  streets: StreetFeature[];
  /** Staff only: click the map to place a quarter's box where it really is. */
  canCalibrate?: boolean;
}

/**
 * Keyless OpenStreetMap vector basemap. Override with NEXT_PUBLIC_MAP_STYLE to
 * point at the municipal basemap (any MapLibre style.json URL).
 */
const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Used when no basemap is reachable: the quarters still render. */
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f6f4ef" } },
  ],
};

/**
 * Without this, the basemap renders Hebrew labels letter-reversed ("דודשא"
 * instead of "אשדוד"): MapLibre draws glyphs left to right unless the plugin
 * reorders them. Served from our own origin so there is no dependency on a CDN.
 */
let rtlPluginRequested = false;
function ensureRtlTextPlugin() {
  if (rtlPluginRequested) return;
  rtlPluginRequested = true;
  try {
    const state = maplibregl.getRTLTextPluginStatus();
    if (state === "unavailable" || state === "requested") {
      maplibregl.setRTLTextPlugin(
        "/vendor/mapbox-gl-rtl-text.min.js",
        true, // load it lazily, only when right-to-left text appears
      );
    }
  } catch {
    // Already set by another map instance; nothing to do.
  }
}

export default function MapView({
  center,
  zoom,
  quarters,
  streets,
  canCalibrate = false,
}: Props) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");

  const [calibrating, setCalibrating] = useState<string>("");
  const calibratingRef = useRef("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const maxQuarterVotes = useMemo(
    () => Math.max(1, ...quarters.map((q) => q.votes)),
    [quarters],
  );
  const uncalibrated = useMemo(
    () => quarters.filter((q) => q.schematic).length,
    [quarters],
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
        const name = quarters.find((q) => q.id === quarterId)?.name ?? "הרובע";
        setSaveMessage(`${name} מוקם במפה.`);
        setCalibrating("");
        calibratingRef.current = "";
        router.refresh();
      } else {
        const data = await response.json().catch(() => ({}));
        setSaveMessage(data.error ?? "השמירה נכשלה.");
      }
    },
    [quarters, router],
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

    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE ?? DEFAULT_STYLE_URL;
    const instance = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    let usedFallback = false;

    function addQuarterLayers() {
      if (instance.getSource("quarters")) return;

      instance.addSource("quarters", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: quarters.map((q) => ({
            type: "Feature",
            id: q.id,
            geometry: { type: "Polygon", coordinates: [q.polygon] },
            properties: { id: q.id, name: q.name, heat: q.votes / maxQuarterVotes },
          })),
        },
      });

      instance.addLayer({
        id: "quarters-fill",
        type: "fill",
        source: "quarters",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "heat"],
            0, "#e9e6df",
            0.35, "#bcd8cd",
            0.7, "#6fae97",
            1, "#1f6f5c",
          ],
          "fill-opacity": 0.4,
        },
      });

      instance.addLayer({
        id: "quarters-outline",
        type: "line",
        source: "quarters",
        paint: { "line-color": "#1f6f5c", "line-width": 1.6, "line-opacity": 0.8 },
      });

      instance.on("click", "quarters-fill", (event) => {
        if (calibratingRef.current) return;
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) setSelected(id);
      });
      instance.on("mouseenter", "quarters-fill", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "quarters-fill", () => {
        if (!calibratingRef.current) instance.getCanvas().style.cursor = "";
      });
    }

    /**
     * Quarter labels are HTML, not map glyphs: the browser lays out Hebrew
     * correctly on its own, and the labels survive a basemap that has no
     * glyph server.
     */
    function addLabels() {
      markers.current.forEach((m) => m.remove());
      markers.current = quarters.map((quarter) => {
        const el = document.createElement("button");
        el.type = "button";
        el.dir = "rtl";
        el.textContent = `${quarter.name}: ${quarter.votes}`;
        el.setAttribute("aria-label", `${quarter.name}, ${votesLabel(quarter.votes)}`);
        el.className =
          "rounded-full border border-line bg-surface/95 px-2 py-[2px] text-[12px] font-medium text-ink shadow-sm";
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          if (!calibratingRef.current) setSelected(quarter.id);
        });
        return new maplibregl.Marker({ element: el })
          .setLngLat(quarter.center)
          .addTo(instance);
      });
    }

    instance.on("load", () => {
      if (!usedFallback) setBasemap("ready");
      addQuarterLayers();
      addLabels();
    });

    // A basemap that cannot be reached must not take the quarters with it.
    instance.on("error", (event) => {
      const message = String(event?.error?.message ?? "");
      const styleFailed = !instance.isStyleLoaded() || message.includes("style");
      if (styleFailed && !usedFallback) {
        usedFallback = true;
        setBasemap("none");
        instance.setStyle(BLANK_STYLE);
        instance.once("styledata", () => {
          addQuarterLayers();
          addLabels();
        });
      }
    });

    instance.on("click", (event) => {
      const quarterId = calibratingRef.current;
      if (!quarterId) return;
      void saveQuarter(quarterId, [event.lngLat.lng, event.lngLat.lat]);
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
  }, [center, zoom, quarters, maxQuarterVotes, saveQuarter]);

  const selectedQuarter = quarters.find((q) => q.id === selected) ?? null;
  const selectedStreets = streets
    .filter((s) => s.quarterId === selected)
    .sort((a, b) => b.votes - a.votes || (b.avgScore ?? 0) - (a.avgScore ?? 0));

  return (
    <div>
      {canCalibrate ? (
        <div className="card mb-3 p-3">
          <p className="text-[15px] font-medium text-ink">כיול רובעים (צוות)</p>
          <p className="mb-2 text-[13px] text-ink-soft">
            בחרו רובע ולחצו על המפה במקום שבו הוא נמצא בפועל. הריבוע והתווית
            יישמרו שם.
            {uncalibrated > 0
              ? ` נותרו ${uncalibrated} רובעים במיקום סכמטי.`
              : " כל הרובעים מוקמו."}
          </p>
          <select
            value={calibrating}
            onChange={(e) => setCalibrating(e.target.value)}
            aria-label="הרובע שממקמים"
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
          >
            <option value="">בחרו רובע למיקום</option>
            {quarters.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
                {q.schematic ? " — סכמטי" : " — מוקם"}
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

      <div className="map-shell">
        <div>
          <div
            ref={container}
            role="application"
            aria-label="מפת הרובעים"
            className="map-canvas h-[380px] w-full overflow-hidden rounded-[14px] border border-line"
          />

      {basemap === "none" ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          מפת הרקע לא נטענה. הרובעים מוצגים על רקע ריק.
        </p>
      ) : null}
      {uncalibrated > 0 && basemap === "ready" ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          מיקומי הרובעים סכמטיים ואינם תואמים את הרקע האמיתי, עד שהצוות ימקם אותם.
        </p>
      ) : null}

          <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
            <span>מעט קולות</span>
            <span className="h-2 flex-1 rounded-full bg-[linear-gradient(to_left,#e9e6df,#bcd8cd,#6fae97,#1f6f5c)]" />
            <span>הרבה קולות</span>
          </div>
        </div>

      <div className="mt-4">
        {selectedQuarter ? (
          <div className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold text-ink">{selectedQuarter.name}</h2>
              <span className="text-[14px] text-ink-faint">
                {votesLabel(selectedQuarter.votes)}
              </span>
            </div>
            {/* The map shows only rated streets; the table shows them all. */}
            <p className="mb-2 text-[13px]">
              <Link
                href={`/streets?quarter=${selectedQuarter.id}&minVotes=0`}
                className="inline-link text-accent underline underline-offset-2"
              >
                כל הרחובות ב{selectedQuarter.name}
              </Link>
            </p>
            {selectedStreets.length === 0 ? (
              <p className="text-[14px] text-ink-soft">
                אין עדיין רחובות מדורגים ברובע הזה.
              </p>
            ) : (
              <ul className="grid gap-1">
                {selectedStreets.map((street) => (
                  <li key={street.id}>
                    <Link
                      href={`/street/${street.id}`}
                      className="flex items-center justify-between rounded-[10px] px-2 py-2 text-[15px] text-ink"
                    >
                      <span>{street.name}</span>
                      <span className="text-[14px] text-ink-faint tabular-nums">
                        {votesLabel(street.votes)}
                        {street.avgScore === null ? "" : ` · ${street.avgScore.toFixed(1)}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-ink-soft">
            בחרו רובע במפה כדי לראות את רחובותיו, מהמדורג ביותר ומטה.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
