"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface QuarterFeature {
  id: string;
  name: string;
  polygon: [number, number][];
  center: [number, number];
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

const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#f6f4ef" },
    },
  ],
};

export default function MapView({ center, zoom, quarters, streets }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const maxQuarterVotes = useMemo(
    () => Math.max(1, ...quarters.map((q) => q.votes)),
    [quarters],
  );
  const maxStreetVotes = useMemo(
    () => Math.max(1, ...streets.map((s) => s.votes)),
    [streets],
  );

  useEffect(() => {
    if (!container.current || map.current) return;

    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE;
    let instance: MapLibreMap;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: styleUrl ?? BLANK_STYLE,
        center,
        zoom,
        attributionControl: styleUrl ? undefined : false,
      });
    } catch {
      setFailed(true);
      return;
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    instance.on("error", () => setFailed(true));

    instance.on("load", () => {
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
            0,
            "#e9e6df",
            0.35,
            "#bcd8cd",
            0.7,
            "#6fae97",
            1,
            "#1f6f5c",
          ],
          "fill-opacity": 0.75,
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
            0,
            "#9aa7b1",
            0.5,
            "#b8742a",
            1,
            "#8a4a10",
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
        const quarterId = streets.find(
          (s) => s.id === (event.features?.[0]?.properties?.id as string),
        )?.quarterId;
        if (quarterId) setSelected(quarterId);
      });
      instance.on("mouseenter", "quarters-fill", () => {
        instance.getCanvas().style.cursor = "pointer";
      });
      instance.on("mouseleave", "quarters-fill", () => {
        instance.getCanvas().style.cursor = "";
      });
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
      {failed ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          טעינת המפה נכשלה בדפדפן הזה. הנתונים המלאים זמינים במסך רחובות.
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
              <span className="text-[14px] text-ink-faint">
                {selectedQuarter.votes} קולות
              </span>
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
