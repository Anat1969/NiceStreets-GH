"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./model3d.css";

/*
 * צופה תלת־ממדי קטן ב-SVG, בלי ספרייה (ענת, 09.11.2026, סעיף 3):
 * "גרפיקה בתלת־ממד — תמיד מאפשרת סיבוב והזזה עם העכבר, ומבט על חזית,
 * חתך, איזומטריה ופרספקטיבה".
 *
 *   גרירה          — סיבוב.
 *   Shift+גרירה, או שתי אצבעות — הזזה.
 *   גלגלת / צביטה  — זום.
 *   חיצים          — סיבוב מהמקלדת; +/- זום.
 *   ארבעה כפתורים  — חזית, חתך, איזומטריה, פרספקטיבה (מעבר מונפש, בלי אנימציה
 *                    למי שביקש פחות תנועה).
 *
 * צירים: x לאורך הרחוב, y לרוחבו (מקיר לקיר), z למעלה. מטרים.
 * הסדר של הציור: כל משטח ממוין לפי עומק ממוצע (אלגוריתם הצייר) — מספיק
 * לגופים הפשוטים של מודל רחוב.
 */

export type Vec3 = [number, number, number];

export interface Shape {
  kind: "polygon" | "line";
  points: Vec3[];
  className: string;
}

export interface Label3D {
  at: Vec3;
  text: string;
  className?: string;
}

interface Camera {
  yaw: number; // מעלות, סביב z
  pitch: number; // מעלות, מעל האופק
  zoom: number;
  panX: number;
  panY: number;
  persp: boolean;
}

const PRESETS: { key: string; label: string; cam: Partial<Camera> }[] = [
  // חזית: מסתכלים על קיר הבניינים, ניצב לרחוב (לאורך y).
  { key: "front", label: "חזית", cam: { yaw: 0, pitch: 0, persp: false } },
  // חתך: מסתכלים לאורך הרחוב (לאורך x), רואים מקיר לקיר.
  { key: "section", label: "חתך", cam: { yaw: 90, pitch: 0, persp: false } },
  { key: "iso", label: "איזומטריה", cam: { yaw: 45, pitch: 35.26, persp: false } },
  { key: "persp", label: "פרספקטיבה", cam: { yaw: 32, pitch: 18, persp: true } },
];

const DEG = Math.PI / 180;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Model3D({
  shapes,
  labels = [],
  center,
  size,
  ariaLabel,
  initial = "iso",
  height = 300,
}: {
  shapes: Shape[];
  labels?: Label3D[];
  /** מרכז הסיבוב, במטרים. */
  center: Vec3;
  /** הממד הגדול של המודל, כדי לקבוע קנה מידה. */
  size: number;
  ariaLabel: string;
  initial?: "front" | "section" | "iso" | "persp";
  height?: number;
}) {
  const start = PRESETS.find((p) => p.key === initial)!.cam;
  const [cam, setCam] = useState<Camera>({
    yaw: 45,
    pitch: 35.26,
    zoom: 1,
    panX: 0,
    panY: 0,
    persp: false,
    ...start,
  });
  const [active, setActive] = useState<string>(initial);
  const anim = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; pan: boolean; cam: Camera } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number; cx: number; cy: number; panX: number; panY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = height * 2;
  const scale = (Math.min(W, H) / (size * 1.25)) * cam.zoom;

  const project = useCallback(
    ([x, y, z]: Vec3): [number, number, number] => {
      const px = x - center[0];
      const py = y - center[1];
      const pz = z - center[2];
      const cy = Math.cos(cam.yaw * DEG);
      const sy = Math.sin(cam.yaw * DEG);
      // סיבוב סביב z: u ימינה על המסך, d עומק (חיובי = רחוק).
      const u = px * cy - py * sy;
      const d0 = px * sy + py * cy;
      const cp = Math.cos(cam.pitch * DEG);
      const sp = Math.sin(cam.pitch * DEG);
      const v = pz * cp - d0 * sp;
      const d = pz * sp + d0 * cp;
      let f = 1;
      if (cam.persp) {
        const dist = size * 2.2;
        f = dist / Math.max(dist * 0.15, dist + d);
      }
      // RTL: המסך הפוך כדי שתחילת הרחוב תהיה מימין.
      return [W / 2 - u * scale * f + cam.panX, H / 2 - v * scale * f + cam.panY, d];
    },
    [cam, center, scale, size, H],
  );

  const drawn = useMemo(() => {
    return shapes
      .map((s, i) => {
        const pts = s.points.map(project);
        const depth = pts.reduce((a, p) => a + p[2], 0) / pts.length;
        return { s, i, pts, depth };
      })
      .sort((a, b) => b.depth - a.depth);
  }, [shapes, project]);

  function goTo(key: string) {
    const target = { ...cam, ...PRESETS.find((p) => p.key === key)!.cam, zoom: 1, panX: 0, panY: 0 };
    setActive(key);
    if (anim.current) cancelAnimationFrame(anim.current);
    if (reducedMotion()) {
      setCam(target);
      return;
    }
    const from = { ...cam };
    // הדרך הקצרה סביב המעגל.
    let dyaw = ((target.yaw - from.yaw + 540) % 360) - 180;
    if (Math.abs(dyaw) < 0.01) dyaw = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 420);
      const e = 1 - Math.pow(1 - k, 3);
      setCam({
        yaw: from.yaw + dyaw * e,
        pitch: from.pitch + (target.pitch - from.pitch) * e,
        zoom: from.zoom + (target.zoom - from.zoom) * e,
        panX: from.panX + (target.panX - from.panX) * e,
        panY: from.panY + (target.panY - from.panY) * e,
        persp: k > 0.5 ? target.persp : from.persp,
      });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }

  useEffect(() => () => {
    if (anim.current) cancelAnimationFrame(anim.current);
  }, []);

  // יחס בין פיקסל מסך ליחידת viewBox.
  const ratio = () => {
    const r = svgRef.current?.getBoundingClientRect();
    return r && r.width ? W / r.width : 1;
  };

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setActive("");
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        d: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: cam.zoom,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        panX: cam.panX,
        panY: cam.panY,
      };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 || e.button === 2, cam };
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = ratio();
      setCam((c) => ({
        ...c,
        zoom: Math.min(6, Math.max(0.3, pinch.current!.zoom * (d / pinch.current!.d))),
        panX: pinch.current!.panX + ((a.x + b.x) / 2 - pinch.current!.cx) * r,
        panY: pinch.current!.panY + ((a.y + b.y) / 2 - pinch.current!.cy) * r,
      }));
      return;
    }
    const g = drag.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.pan) {
      const r = ratio();
      setCam({ ...g.cam, panX: g.cam.panX + dx * r, panY: g.cam.panY + dy * r });
    } else {
      setCam({
        ...g.cam,
        yaw: g.cam.yaw - dx * 0.5,
        pitch: Math.max(-10, Math.min(89, g.cam.pitch + dy * 0.4)),
      });
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
  }

  // גלגלת: זום. מאזין לא פסיבי, כדי שהדף לא יגלול מתחת למודל.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      setActive("");
      setCam((c) => ({ ...c, zoom: Math.min(6, Math.max(0.3, c.zoom * Math.exp(-ev.deltaY * 0.0015))) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    const k = e.key;
    let handled = true;
    setActive("");
    if (k === "ArrowLeft") setCam((c) => ({ ...c, yaw: c.yaw + 10 }));
    else if (k === "ArrowRight") setCam((c) => ({ ...c, yaw: c.yaw - 10 }));
    else if (k === "ArrowUp") setCam((c) => ({ ...c, pitch: Math.min(89, c.pitch + 8) }));
    else if (k === "ArrowDown") setCam((c) => ({ ...c, pitch: Math.max(-10, c.pitch - 8) }));
    else if (k === "+" || k === "=") setCam((c) => ({ ...c, zoom: Math.min(6, c.zoom * 1.2) }));
    else if (k === "-") setCam((c) => ({ ...c, zoom: Math.max(0.3, c.zoom / 1.2) }));
    else handled = false;
    if (handled) e.preventDefault();
  }

  return (
    <div className="m3d">
      <div className="m3d-views" role="group" aria-label="נקודת מבט">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="m3d-btn"
            aria-pressed={active === p.key}
            onClick={() => goTo(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="m3d-canvas"
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        data-yaw={Math.round(cam.yaw)}
        data-pitch={Math.round(cam.pitch)}
      >
        {drawn.map(({ s, i, pts }) =>
          s.kind === "polygon" ? (
            <polygon
              key={i}
              points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
              className={s.className}
            />
          ) : (
            <polyline
              key={i}
              points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
              className={s.className}
              fill="none"
            />
          ),
        )}
        {labels.map((l, i) => {
          const [x, y] = project(l.at);
          return (
            <text key={i} x={x} y={y} textAnchor="middle" className={l.className ?? "bm-tag"}>
              {l.text}
            </text>
          );
        })}
      </svg>
      <p className="how m3d-help">
        גוררים כדי לסובב. Shift וגרירה, או שתי אצבעות, כדי להזיז. גלגלת או צביטה לזום. מהמקלדת: חיצים ופלוס ומינוס.
      </p>
    </div>
  );
}

/** קופסה (בניין, רצועה) כשישה משטחים. */
export function box(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  className: string,
): Shape[] {
  const P = (x: number, y: number, z: number): Vec3 => [x, y, z];
  return [
    { kind: "polygon", className, points: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)] },
    { kind: "polygon", className, points: [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)] },
    { kind: "polygon", className, points: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)] },
    { kind: "polygon", className, points: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)] },
    { kind: "polygon", className, points: [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)] },
    { kind: "polygon", className, points: [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)] },
  ];
}
