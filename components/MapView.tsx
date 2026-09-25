"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import { votesLabel } from "@/lib/hebrew";
import "maplibre-gl/dist/maplibre-gl.css";

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
  line: [number, number][];
  votes: number;
  avgScore: number | null;
}

interface Props {
  center: [number, number];
  zoom: number;
  quarters: QuarterFeature[];
  streets: StreetFeature[];
}

/**
 * Keyless OpenStreetMap vector basemap. Override with NEXT_PUBLIC_MAP_STYLE to
 * point at the municipal basemap (any MapLibre style.json URL).
 */
const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Used when no basemap is reachable: the data layers still render. */
const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f6f4ef" } },
  ],
};

export default function MapView({ center, zoom, quarters, streets }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"loading" | "ready" | "none">("loading");

  const maxQuarterVotes = useMemo(
    () => Math.max(1, ...quarters.map((q) => q.votes)),
    [quarters],
  );
  const maxStreetVotes = useMemo(
    () => Math.max(1, ...streets.map((s) => s.votes)),
    [streets],
  );
  const schematicGeometry = useMemo(
    () => quarters.some((q) => q.schematic),
    [quarters],
  );

  useEffect(() => {
    if (!container.current || map.current) return;

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

    /** Prefer Hebrew place labels where the basemap carries them. */
    function hebrewLabels() {
      for (const layer of instance.getStyle().layers ?? []) {
        if (layer.type !== "symbol") continue;
        const field = instance.getLayoutProperty(layer.id, "text-field");
        if (!field) continue;
        try {
          instance.setLayoutProperty(layer.id, "text-field", [
            "coalesce",
            ["get", "name:he"],
            ["get", "name"],
          ]);
        } catch {
          // A layer whose label is not a plain name field; leave it as it is.
        }
      }
    }

    function addDataLayers() {
      if (instance.getSource("quarters")) return;

      instance.addSource("quarters", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: quarters.map((q) => ({
            type: "Feature",
            id: q.id,
            geometry: { type: "Polygon", coordinates: [q.polygon] },
            properties: {
              id: q.id,
              name: q.name,
              votes: q.votes,
              heat: q.votes / maxQuarterVotes,
            },
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
          // Translucent over a basemap so streets below stay readable.
          "fill-opacity": 0.45,
        },
      });

      instance.addLayer({
        id: "quarters-outline",
        type: "line",
        source: "quarters",
        paint: { "line-color": "#ffffff", "line-width": 1.5 },
      });

      instance.addSource("streets", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: streets.map((s) => ({
            type: "Feature",
            id: s.id,
            geometry: { type: "LineString", coordinates: s.line },
            properties: {
              id: s.id,
              name: s.name,
              votes: s.votes,
              heat: s.votes / maxStreetVotes,
            },
          })),
        },
      });

      instance.addLayer({
        id: "streets-line",
        type: "line",
        source: "streets",
        paint: {
          "line-color": [
            "interpolate",
            ["linear"],
            ["get", "heat"],
            0, "#9aa7b1",
            0.5, "#b8742a",
            1, "#8a4a10",
          ],
          "line-width": ["interpolate", ["linear"], ["get", "heat"], 0, 2, 1, 7],
          "line-opacity": 0.95,
        },
      });

      instance.on("click", "quarters-fill", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        if (id) setSelected(id);
      });
      instance.on("click", "streets-line", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        const quarterId = streets.find((s) => s.id === id)?.quarterId;
        if (quarterId) setSelected(quarterId);
      });
      for (const layer of ["quarters-fill", "streets-line"]) {
        instance.on("mouseenter", layer, () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", layer, () => {
          instance.getCanvas().style.cursor = "";
        });
      }
    }

    instance.on("load", () => {
      if (!usedFallback) {
        hebrewLabels();
        setBasemap("ready");
      }
      addDataLayers();
    });

    // A basemap that cannot be reached must not take the data layers with it.
    instance.on("error", (event) => {
      const message = String(event?.error?.message ?? "");
      const styleFailed = !instance.isStyleLoaded() || message.includes("style");
      if (styleFailed && !usedFallback) {
        usedFallback = true;
        setBasemap("none");
        instance.setStyle(BLANK_STYLE);
        instance.once("styledata", addDataLayers);
      }
    });

    return () => {
      instance.remove();
      map.current = null;
    };
  }, [center, zoom, quarters, streets, maxQuarterVotes, maxStreetVotes]);

  const selectedQuarter = quarters.find((q) => q.id === selected) ?? null;
  const selectedStreets = streets
    .filter((s) => s.quarterId === selected)
    .sort((a, b) => b.votes - a.votes);

  return (
    <div>
      <div
        ref={container}
        role="application"
        aria-label="מפת הרחובות והרובעים"
        className="h-[380px] w-full overflow-hidden rounded-[14px] border border-line"
      />

      {basemap === "none" ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          מפת הרקע לא נטענה. שכבות הקולות מוצגות על רקע ריק.
        </p>
      ) : null}
      {schematicGeometry && basemap === "ready" ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          שימו לב: מיקומי הרובעים והרחובות סכמטיים ואינם תואמים את הרקע האמיתי, עד
          לטעינת שכבות ה־GIS העירוניות.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
        <span>מעט קולות</span>
        <span className="h-2 flex-1 rounded-full bg-[linear-gradient(to_left,#e9e6df,#bcd8cd,#6fae97,#1f6f5c)]" />
        <span>הרבה קולות</span>
      </div>

      <div className="mt-4">
        {selectedQuarter ? (
          <div className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold text-ink">{selectedQuarter.name}</h2>
              <span className="text-[14px] text-ink-faint">{votesLabel(selectedQuarter.votes)}</span>
            </div>
            {selectedStreets.length === 0 ? (
              <p className="text-[14px] text-ink-soft">אין עדיין רחובות מדורגים ברובע הזה.</p>
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
                        {street.votes} · {street.avgScore === null ? "—" : street.avgScore.toFixed(1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-ink-soft">בחרו רובע במפה כדי לראות את רחובותיו.</p>
        )}
      </div>
    </div>
  );
}
