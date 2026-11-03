"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cacheKey, fetchOsm } from "@/components/StreetSection";
import { measureSection, parseOverpass, type LonLat } from "@/lib/street-section";
import type { LayerReading } from "@/lib/street-layers";
import {
  HALF_LENGTH_M,
  SPAWN_Z,
  STATION_Z,
  WALK_LAYERS,
  buildWalkScene,
  layerAt,
  progressAt,
  walkPlan,
  type WalkScene,
} from "@/lib/street-walk";

/*
 * הליכה ברחוב: <space-walk> המשותף (walk.js) עם תוואי הבניינים האמיתיים,
 * וארבע השכבות נדלקות אחת אחרי השנייה כשההולך מתקדם.
 * walk.js נטען קודם מ-GitHub Pages של התיק, ו-Vercel הוא גיבוי (walk-standard.md).
 */
const WALK_SRC = [
  "https://anat1969.github.io/AppOfApp-GH/walk.js",
  "https://appofapp-gh.vercel.app/walk.js",
];

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "space-walk": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        eye?: string;
        variant?: string;
      };
    }
  }
}

/** מה שקוראים מ-walk.js. `_pos` ו-`_move` פנימיים לרכיב: כשאינם, ההליכה עובדת והשכבות מתחלפות רק בבחירה. */
type WalkEl = HTMLElement & {
  plan: unknown;
  _pos?: { x: number; z: number };
  _yaw?: number;
  _move?: number;
};

let walkLoad: Promise<boolean> | null = null;
function loadWalk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (customElements.get("space-walk")) return Promise.resolve(true);
  if (walkLoad) return walkLoad;
  walkLoad = (async () => {
    for (const src of WALK_SRC) {
      const ok = await new Promise<boolean>((resolve) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve(Boolean(customElements.get("space-walk")));
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      });
      if (ok) return true;
    }
    return false;
  })();
  return walkLoad;
}

type Data =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "none" }
  | { kind: "ready"; scene: WalkScene; widthM: number | null; fetchedAt: string };

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 1 });

export default function StreetWalk({
  streetId,
  streetName,
  center,
  layers,
  photoId,
  dataBase = "/geo/sections/",
}: {
  streetId: string;
  streetName: string;
  center: LonLat;
  layers: LayerReading[];
  /** התמונה המאושרת האחרונה של הרחוב, או null. */
  photoId: string | null;
  dataBase?: string;
}) {
  const [data, setData] = useState<Data>({ kind: "loading" });
  const [ready, setReady] = useState<"wait" | "ok" | "fail">("wait");
  const [active, setActive] = useState(0);
  /* השכבות שכבר נדלקו: נשארות דלוקות אחרי שעוברים אותן. */
  const [reached, setReached] = useState(0);
  const [progress, setProgress] = useState(0);
  const [auto, setAuto] = useState(false);
  const [reduce, setReduce] = useState(false);
  const el = useRef<WalkEl | null>(null);
  const planSeq = useRef(0);
  const activeRef = useRef(0);
  const eye = useRef("160");

  useEffect(() => {
    setReduce(matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /* הנתונים: אותו קובץ שמור שהחתך קורא, ואחריו המטמון והשרת החי. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let raw: unknown = null;
        let fetchedAt = "";
        try {
          const res = await fetch(`${dataBase}${streetId}.json`);
          if (res.ok) {
            const file = await res.json();
            if (Array.isArray(file?.elements)) {
              raw = file;
              fetchedAt = String(file.fetchedAt ?? "").split("-").reverse().join(".");
            }
          }
        } catch {
          /* אין קובץ לרחוב: ממשיכים. */
        }
        if (!raw) {
          try {
            const cached = JSON.parse(localStorage.getItem(cacheKey(center)) ?? "null");
            if (cached?.raw) {
              raw = cached.raw;
              fetchedAt = cached.at;
            }
          } catch {
            /* אין מטמון. */
          }
        }
        if (!raw) {
          raw = await fetchOsm(center);
          fetchedAt = new Date().toLocaleDateString("he-IL");
        }
        const osm = parseOverpass(raw);
        const scene = buildWalkScene(center, osm, streetName);
        const m = measureSection(center, osm, streetName);
        if (!alive) return;
        setData(
          scene && scene.buildings.length > 0
            ? { kind: "ready", scene, widthM: m ? m.widthM : null, fetchedAt }
            : { kind: "none" },
        );
      } catch {
        if (alive) setData({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [center, streetId, streetName, dataBase]);

  useEffect(() => {
    if (data.kind !== "ready") return;
    let alive = true;
    loadWalk().then((ok) => alive && setReady(ok ? "ok" : "fail"));
    return () => {
      alive = false;
    };
  }, [data.kind]);

  const summaries = useMemo(
    () =>
      layers.map((L, i) => ({
        insight: `**${i + 1} ${L.title}:** ${L.question}`,
        explain:
          L.score10 === null
            ? `אין עדיין **ציון תושבים** בשכבה. ${L.criteria.filter((c) => c.value).length} מתוך **${L.criteria.length}** הקריטריונים עם ערך.`
            : `ציון התושבים בשכבה: **${L.score10.toFixed(1)}** מתוך **10**. ${L.criteria.length} קריטריונים, פירוט בכרטיס השכבה.`,
      })),
    [layers],
  );

  /** מציב את התוכנית מחדש: שכבה פעילה ונקודה. מזהה חדש, כדי ש-walk.js יקבל את הנקודה. */
  const place = useCallback(
    (layer: number, at?: { x: number; z: number; yaw: number }) => {
      const node = el.current;
      if (!node || data.kind !== "ready") return;
      const { scene, widthM, fetchedAt } = data;
      planSeq.current += 1;
      node.setAttribute("variant", WALK_LAYERS[layer].key);
      node.setAttribute("eye", eye.current);
      node.plan = walkPlan(scene, {
        id: `${streetId}:${planSeq.current}`,
        title: `הליכה ב${streetName} · 120 מ'`,
        widthM,
        active: layer,
        spawn: at ?? { x: scene.spawnX, z: SPAWN_Z, yaw: 0 },
        summaries,
        source:
          `מקורות: תוואי בניינים ורחובות © OpenStreetMap contributors (ODbL), נשלף ב-${fetchedAt}. ` +
          "ציונים: קולות התושבים באפליקציה. השכבות: הרחובות הטובים, מינהל התכנון, 2026.",
      });
      activeRef.current = layer;
      setActive(layer);
      setReached((r) => Math.max(r, layer));
    },
    [data, streetId, streetName, summaries],
  );

  /* הצבה ראשונה, כשהרכיב נטען. */
  useEffect(() => {
    if (ready === "ok" && data.kind === "ready" && el.current && planSeq.current === 0) place(0);
  }, [ready, data.kind, place]);

  /* מעקב אחרי ההולך: השכבה נקבעת לפי המקום לאורך הרחוב. */
  useEffect(() => {
    if (ready !== "ok") return;
    const t = setInterval(() => {
      const node = el.current;
      const pos = node?._pos;
      if (!node || !pos || typeof pos.z !== "number") return;
      setProgress(progressAt(pos.z));
      const L = layerAt(pos.z);
      if (L !== activeRef.current) {
        place(L, { x: pos.x, z: pos.z, yaw: ((node._yaw ?? 0) * 180) / Math.PI });
      }
      if (pos.z <= -HALF_LENGTH_M + 6 && typeof node._move === "number" && node._move > 0) {
        node._move = 0;
        setAuto(false);
      }
    }, 200);
    return () => clearInterval(t);
  }, [ready, place]);

  /* בחירה בפאנל של walk.js (כפתורי השכבות שם): מעבר לתחנה. */
  useEffect(() => {
    const node = el.current;
    if (!node || ready !== "ok") return;
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ eye: number; variant: string }>).detail;
      if (d?.eye) eye.current = String(d.eye);
      const i = WALK_LAYERS.findIndex((L) => L.key === d?.variant);
      if (i >= 0 && i !== activeRef.current) goStation(i);
    };
    node.addEventListener("walkchange", onChange);
    return () => node.removeEventListener("walkchange", onChange);
  });

  function goStation(i: number) {
    if (data.kind !== "ready") return;
    if (el.current && typeof el.current._move === "number") el.current._move = 0;
    setAuto(false);
    setProgress(progressAt(STATION_Z[i]));
    place(i, { x: data.scene.stationX[i], z: STATION_Z[i], yaw: 0 });
  }

  function toggleAuto() {
    const node = el.current;
    if (!node || data.kind !== "ready") return;
    /* בלי תנועה: מעבר לתחנה הבאה. */
    if (reduce || typeof node._move !== "number") {
      goStation((activeRef.current + 1) % 4);
      return;
    }
    if (auto) {
      node._move = 0;
      setAuto(false);
      return;
    }
    if ((node._pos?.z ?? SPAWN_Z) <= -HALF_LENGTH_M + 8) place(0);
    node._move = 1;
    setAuto(true);
  }

  const L = layers[active];
  const widthM = data.kind === "ready" ? data.widthM : null;

  return (
    <div className="walk">
      <div className="walk-top">
        {/* צילום הרחוב: מסגרת קבועה. תמונה של תושב כשיש, ומקום מסומן לצילום של האגף. */}
        <figure className="walk-photo">
          <figcaption className="eyebrow">צילום הרחוב</figcaption>
          {photoId ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${photoId}`} alt={`${streetName}, צילום מהרחוב`} loading="lazy" />
              <p className="walk-photo-note">צילום של תושב, אושר בידי הצוות. צילום מקצועי בגובה העיניים ייכנס כאן.</p>
            </>
          ) : (
            <div className="walk-photo-empty">
              <span className="walk-photo-name">{streetName}</span>
              <span>
                כאן ייכנס צילום של הרחוב בגובה העיניים, מנקודת ההתחלה של ההליכה. עד אז ההליכה בנויה
                מתוואי הבניינים שבמפה.
              </span>
            </div>
          )}
        </figure>

        <div className="walk-side">
          {L ? (
            <div className="walk-detail" key={L.key} data-key={L.key}>
              <p className="walk-detail-q">
                <b>{L.title}:</b> {L.question}
              </p>
              <p className="walk-detail-m">{L.scoreMeaning}</p>
              <ul>
                {L.criteria.map((c) => (
                  <li key={c.name} data-source={c.source}>
                    <span className="walk-c-name">{c.name}</span>
                    <span className="walk-c-val">{c.value ?? "—"}</span>
                    <span className="walk-c-meaning">{c.meaning}</span>
                  </li>
                ))}
                {L.key === "section" && widthM ? (
                  <li data-source="osm">
                    <span className="walk-c-name">רוחב מקיר לקיר</span>
                    <span className="walk-c-val">{Math.round(widthM)} מ&apos;</span>
                    <span className="walk-c-meaning">
                      נמדד מתוואי הבניינים ב-OpenStreetMap. זו הרצועה המודגשת בהליכה.
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <div className="walk-rail">
      <ol className="walk-strip" aria-label="ארבע השכבות לאורך ההליכה">
        {layers.map((layer, i) => {
          const state = i === active ? "on" : i <= reached ? "past" : "next";
          return (
            <li key={layer.key}>
              <button
                type="button"
                className="walk-layer"
                data-state={state}
                data-key={layer.key}
                aria-pressed={i === active}
                onClick={() => goStation(i)}
                disabled={ready !== "ok"}
              >
                <span className="walk-layer-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="walk-layer-t">{layer.title}</span>
                <span className="walk-layer-s num">
                  {layer.score10 === null ? "—" : layer.score10.toFixed(1)}
                </span>
                <span className="walk-layer-u">{layer.score10 === null ? "אין ציון" : "מתוך 10"}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="walk-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p className="walk-progress-note">
        {ready === "ok"
          ? `עברתם ${fmt(Math.round(progress * 120))} מתוך 120 מ'. כל רבע מהדרך מדליק שכבה.`
          : "כל רבע מ-120 מ' של הליכה מדליק שכבה."}
      </p>
      </div>

      {data.kind === "loading" ? (
        <p className="walk-msg">טוען את תוואי הבניינים של {streetName}…</p>
      ) : data.kind === "error" ? (
        <p className="walk-msg">שרת המפות הפתוח לא ענה כרגע, ולכן אין הליכה. השכבות והציונים למעלה מלאים.</p>
      ) : data.kind === "none" ? (
        <p className="walk-msg">אין במפה הפתוחה בניינים סביב מרכז הרחוב, ולכן אין ממה לבנות הליכה.</p>
      ) : (
        <>
          <div className="walk-actions">
            <button type="button" className="walk-go" onClick={toggleAuto} disabled={ready !== "ok"}>
              {reduce ? "לתחנה הבאה" : auto ? "עצירה" : "ללכת לאורך הרחוב"}
            </button>
            <span className="walk-actions-note">
              {data.scene.buildings.length} בניינים מהמפה, ל-{data.scene.knownCount} מהם קומות רשומות. לשאר
              הגובה הוא הערכה של 4 קומות.
            </span>
          </div>
          {ready === "fail" ? (
            <p className="walk-msg">רכיב ההליכה לא נטען. בדקו חיבור לרשת ורעננו.</p>
          ) : (
            <space-walk ref={el as React.RefObject<HTMLElement>} className="walk-3d" eye="160" />
          )}
        </>
      )}
    </div>
  );
}
