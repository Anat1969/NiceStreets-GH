"use client";

import { useEffect, useState } from "react";

/*
 * "על שם מה הרחוב?" — משפט אחד מוויקיפדיה העברית (ענת, 09.11.2026).
 * הבקשה יוצאת מהדפדפן של המבקר (ה-API של ויקיפדיה פתוח ל-CORS), ולכן
 * אין כאן שרת ואין מטמון. שם רחוב במרשם כתוב לפעמים הפוך ("בגין מנחם"),
 * ולכן נבדקים כמה נוסחים. דף פירושונים או דף בלי תקציר — לא מוצג.
 * תמיד מסומן כמקור חיצוני, עם קישור, כי ייתכן שזה לא האדם שעל שמו הרחוב.
 */
const PREFIXES = /^(שד|שדרות|דרך|רחוב|סמטת|כיכר|ככר|מבוא|מדרחוב)\s+/;

function candidates(name: string, synonyms: string[]): string[] {
  const out = new Set<string>();
  for (const raw of [name, ...synonyms]) {
    const base = raw.replace(/["׳']/g, (m) => (m === '"' ? "״" : m)).replace(PREFIXES, "").trim();
    if (!base) continue;
    out.add(base);
    const words = base.split(/\s+/);
    if (words.length === 2) out.add(`${words[1]} ${words[0]}`);
  }
  return [...out].slice(0, 5);
}

interface Summary {
  title: string;
  extract: string;
  url: string;
}

export default function StreetNameWiki({ name, synonyms = [] }: { name: string; synonyms?: string[] }) {
  const [found, setFound] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const title of candidates(name, synonyms)) {
        try {
          const r = await fetch(
            `https://he.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { headers: { accept: "application/json" } },
          );
          if (!r.ok) continue;
          const d = await r.json();
          if (d.type !== "standard" || !d.extract) continue;
          const first = String(d.extract).split(/(?<=\.)\s/)[0];
          if (alive)
            setFound({ title: d.title, extract: first, url: d.content_urls?.desktop?.page ?? "" });
          return;
        } catch {
          /* רשת חסומה או ויקיפדיה לא זמינה — פשוט לא מציגים. */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [name, synonyms]);

  if (!found) return null;
  return (
    <aside className="wiki-blurb">
      <p className="wiki-kicker">על שם מה הרחוב?</p>
      <p className="wiki-text">{found.extract}</p>
      <p className="source-line">
        מקור:{" "}
        <a href={found.url} target="_blank" rel="noopener noreferrer" className="inline-link underline">
          ויקיפדיה, &quot;{found.title}&quot;
        </a>
        . ההתאמה לפי השם בלבד, וייתכן שהרחוב נקרא על שם אחר.
      </p>
    </aside>
  );
}
