"use client";

import Link from "next/link";
import { useState } from "react";
import type { FamilyKey } from "@/lib/city";

/**
 * החדר העירוני: רחוב אחד בהטלה איזומטרית, בנוי מארבע השכבות שבהן
 * נמדד כל רחוב. שלד (הרשת והצמתים), חתך (מדרכה, כביש, מדרכה), דופן
 * (הבניינים והחזיתות), מרקם ואקלים (העצים והצל).
 *
 * השכבות נבנות מלמטה למעלה כשהדף נטען. ריחוף על שכבה, או על הכרטיס שלה
 * במקרא, מרים אותה ומעמעם את השאר. SVG ולא CSS 3D: אמין בכל דפדפן ובצילום.
 * הצד הקרוב מצויר כחתך נמוך, כמו בשרטוט אדריכלי, כדי שלא יסתיר את הרחוב.
 */

export interface RoomLayer {
  key: FamilyKey;
  title: string;
  question: string;
  count: number;
}

const COLOR: Record<FamilyKey, string> = {
  skeleton: "var(--asphalt)",
  section: "var(--kurkar)",
  frontage: "var(--brand-500)",
  texture: "var(--canopy)",
};

const K = 3.1;
const COS = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z = 0): [number, number] => [
  (x - y) * COS * K,
  ((x + y) * 0.5 - z) * K,
];
const pts = (list: [number, number, number?][]) =>
  list
    .map(([x, y, z]) => iso(x, y, z ?? 0).map((n) => n.toFixed(1)).join(","))
    .join(" ");

/* הרחוב לאורך ציר x. y: בניין · מדרכה · כביש · מדרכה · בניין. */
const FAR_LOT = [0, 14];
const FAR_WALK = [14, 21];
const ROAD = [21, 31];
const NEAR_WALK = [31, 38];
const NEAR_LOT = [38, 50];
const CROSS = [46, 56];
const LEN = 100;

const FAR_BUILDINGS: [number, number, number][] = [
  [0, 13, 22],
  [14, 26, 30],
  [27, 45, 18],
  [57, 68, 26],
  [69, 85, 34],
  [86, 100, 20],
];
const NEAR_BUILDINGS: [number, number][] = [
  [0, 20],
  [22, 45],
  [57, 78],
  [80, 100],
];
const TREES_FAR = [6, 18, 30, 40, 62, 74, 86, 96];
const TREES_NEAR = [10, 24, 36, 64, 78, 92];

function Box({
  x0,
  x1,
  y0,
  y1,
  h,
  fill,
  windows = false,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  h: number;
  fill: string;
  windows?: boolean;
}) {
  const floors = windows ? Math.floor((h - 6) / 4) : 0;
  return (
    <g>
      <polygon
        points={pts([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]])}
        fill={fill}
        style={{ filter: "brightness(0.72)" }}
      />
      <polygon
        points={pts([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]])}
        fill={fill}
        style={{ filter: "brightness(0.9)" }}
      />
      <polygon
        points={pts([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]])}
        fill={fill}
        style={{ filter: "brightness(1.12)" }}
      />
      {windows ? (
        <>
          {/* קומת קרקע שקופה: חזית פעילה. */}
          <polygon
            points={pts([[x0 + 1, y1, 0.6], [x1 - 1, y1, 0.6], [x1 - 1, y1, 4.4], [x0 + 1, y1, 4.4]])}
            fill="#d9ecf2"
            opacity={0.95}
          />
          {Array.from({ length: floors }, (_, f) => {
            const z = 7 + f * 4;
            return (
              <polygon
                key={f}
                points={pts([[x0 + 1.2, y1, z], [x1 - 1.2, y1, z], [x1 - 1.2, y1, z + 1.6], [x0 + 1.2, y1, z + 1.6]])}
                fill="#eef3f2"
                opacity={0.55}
              />
            );
          })}
        </>
      ) : null}
    </g>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  const [bx, by] = iso(x, y, 0);
  const [cx, cy] = iso(x, y, 10);
  return (
    <g>
      <ellipse cx={bx + 6} cy={by + 2} rx={13} ry={6} fill="rgb(22 32 43 / 16%)" />
      <line x1={bx} y1={by} x2={cx} y2={cy + 6} stroke="#6b5338" strokeWidth={2.4} />
      <circle cx={cx} cy={cy} r={11} fill="var(--canopy)" />
      <circle cx={cx - 3} cy={cy - 4} r={6} fill="#fff" opacity={0.14} />
    </g>
  );
}

export default function StreetRoom({ layers }: { layers: RoomLayer[] }) {
  const [active, setActive] = useState<FamilyKey | null>(null);
  const on = (key: FamilyKey | null) => () => setActive(key);
  const layerProps = (key: FamilyKey, i: number) => ({
    className: "room-layer",
    "data-layer": key,
    style: { "--i": i } as React.CSSProperties,
    onPointerEnter: on(key),
  });

  const [minX] = iso(0, NEAR_LOT[1]);
  const [maxX] = iso(LEN, 0);
  const [, minY] = iso(0, 0, 40);
  const [, maxY] = iso(LEN, NEAR_LOT[1]);
  const pad = 14;
  const viewBox = `${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${(maxX - minX + 2 * pad).toFixed(0)} ${(maxY - minY + 2 * pad).toFixed(0)}`;

  const tag = (x: number, y: number, z: number, text: string) => {
    const [tx, ty] = iso(x, y, z);
    return (
      <text x={tx} y={ty} className="room-tag" textAnchor="middle" fontSize={13}>
        {text}
      </text>
    );
  };

  return (
    <div className="room-wrap">
      <div className="room" data-active={active ?? undefined} onPointerLeave={on(null)}>
        <svg
          viewBox={viewBox}
          role="img"
          aria-label="רחוב בארבע שכבות: שלד, חתך, דופן, מרקם ואקלים"
        >
          <polygon
            points={pts([[0, 0], [LEN, 0], [LEN, NEAR_LOT[1]], [0, NEAR_LOT[1]]])}
            fill="var(--sand)"
          />

          {/* חתך: מדרכה, כביש, מדרכה. */}
          <g {...layerProps("section", 0)}>
            <polygon points={pts([[0, FAR_WALK[0]], [LEN, FAR_WALK[0]], [LEN, FAR_WALK[1]], [0, FAR_WALK[1]]])} fill="var(--kurkar)" />
            <polygon points={pts([[0, ROAD[0]], [LEN, ROAD[0]], [LEN, ROAD[1]], [0, ROAD[1]]])} fill="var(--asphalt)" />
            <polygon points={pts([[0, NEAR_WALK[0]], [LEN, NEAR_WALK[0]], [LEN, NEAR_WALK[1]], [0, NEAR_WALK[1]]])} fill="var(--kurkar)" />
          </g>

          {/* שלד: הרחוב החוצה, קווי האמצע והצומת. */}
          <g {...layerProps("skeleton", 1)}>
            <polygon points={pts([[CROSS[0], 0], [CROSS[1], 0], [CROSS[1], NEAR_LOT[1]], [CROSS[0], NEAR_LOT[1]]])} fill="var(--asphalt)" />
            <polyline
              points={pts([[0, (ROAD[0] + ROAD[1]) / 2], [LEN, (ROAD[0] + ROAD[1]) / 2]])}
              fill="none"
              stroke="#f3e9c6"
              strokeWidth={1.6}
              strokeDasharray="7 6"
            />
            <polyline
              points={pts([[(CROSS[0] + CROSS[1]) / 2, 0], [(CROSS[0] + CROSS[1]) / 2, NEAR_LOT[1]]])}
              fill="none"
              stroke="#f3e9c6"
              strokeWidth={1.6}
              strokeDasharray="7 6"
            />
            {(() => {
              const [nx, ny] = iso((CROSS[0] + CROSS[1]) / 2, (ROAD[0] + ROAD[1]) / 2);
              return (
                <>
                  <circle cx={nx} cy={ny} r={9} fill="none" stroke="#fff" strokeWidth={2} />
                  <circle cx={nx} cy={ny} r={3.5} fill="#fff" />
                </>
              );
            })()}
          </g>

          {/* דופן: הבניינים בצד הרחוק, עם חזית לרחוב. */}
          <g {...layerProps("frontage", 2)}>
            {FAR_BUILDINGS.map(([x0, x1, h]) => (
              <Box key={x0} x0={x0} x1={x1} y0={FAR_LOT[0]} y1={FAR_LOT[1]} h={h} fill="var(--brand-300)" windows />
            ))}
          </g>

          {/* מרקם ואקלים: העצים ברחוק. */}
          <g {...layerProps("texture", 3)}>
            {TREES_FAR.map((x) => (
              <Tree key={x} x={x} y={(FAR_WALK[0] + FAR_WALK[1]) / 2} />
            ))}
          </g>

          {/* הצד הקרוב: חתך נמוך, כמו בשרטוט. */}
          <g {...layerProps("frontage", 2)}>
            {NEAR_BUILDINGS.map(([x0, x1]) => (
              <Box key={x0} x0={x0} x1={x1} y0={NEAR_LOT[0]} y1={NEAR_LOT[1]} h={5} fill="var(--brand-700)" />
            ))}
          </g>
          <g {...layerProps("texture", 3)}>
            {TREES_NEAR.map((x) => (
              <Tree key={x} x={x} y={(NEAR_WALK[0] + NEAR_WALK[1]) / 2} />
            ))}
          </g>
          {/* התוויות אחרונות, כדי ששום שכבה לא תסתיר אותן. */}
          <g {...layerProps("section", 0)}>{tag(LEN - 6, NEAR_WALK[1] + 3, 0, "חתך")}</g>
          <g {...layerProps("skeleton", 1)}>{tag((CROSS[0] + CROSS[1]) / 2, 4, 0, "שלד")}</g>
          <g {...layerProps("frontage", 2)}>{tag(77, FAR_LOT[0] + 4, 38, "דופן")}</g>
          <g {...layerProps("texture", 3)}>{tag(TREES_FAR[0], FAR_WALK[1], 19, "מרקם")}</g>
        </svg>
      </div>

      <ul className="room-legend">
        {layers.map((layer) => (
          <li key={layer.key}>
            <Link
              href={`/learn/criteria/${layer.key}`}
              className="pressable"
              aria-current={active === layer.key ? "true" : undefined}
              onPointerEnter={on(layer.key)}
              onPointerLeave={on(null)}
              onFocus={on(layer.key)}
              onBlur={on(null)}
            >
              <span className="room-swatch" style={{ background: COLOR[layer.key] }} aria-hidden="true" />
              <span className="room-legend-title">
                {layer.title} <bdi className="num text-[12px] text-ink-faint">{layer.count}</bdi>
              </span>
              <span className="room-legend-line">{layer.question}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
