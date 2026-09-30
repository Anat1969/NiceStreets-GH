import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CRITERIA_FAMILIES,
  EXAMPLES,
  FAMILY_MAP,
  GIS_METRICS,
  QUESTION_MAP,
} from "@/lib/city";
import { EXAMPLE_MAP } from "@/lib/city";
import type { Criterion, FamilyKey } from "@/lib/city";
import { CRITERION_ICONS } from "@/components/icons";
import { BackLink, PrevNext } from "@/components/learn-nav";
import ImageFrame from "@/components/ImageFrame";
import { getStore } from "@/lib/store";
import { imageSlot } from "@/lib/content-images";
import { isAdmin } from "@/lib/session";

/*
 * הדף נבנה בכל בקשה: הוא קורא את תפקיד המשתמשת מהעוגייה ואת רשימת תמונות
 * התוכן, ולכן גרסה שנבנתה מראש הייתה מקפיאה תמונה שהועלתה אחרי הבנייה.
 */
export const dynamic = "force-dynamic";

function Source({ criterion }: { criterion: Criterion }) {
  if (criterion.link.kind === "question") {
    return (
      <p className="text-[13px] text-ink-soft">
        נמדד בשאלה שלכם:{" "}
        <Link href="/choose" className="inline-link text-accent underline underline-offset-2">
          {QUESTION_MAP[criterion.link.questionKey].label}
        </Link>
      </p>
    );
  }
  if (criterion.link.kind === "gis") {
    return (
      <p className="text-[13px] text-ink-soft">
        נמדד בנתוני העירייה: {GIS_METRICS[criterion.link.metric].label}
      </p>
    );
  }
  return (
    <p className="text-[13px] text-warm">טרם שויך מקור מדידה. {criterion.link.note}</p>
  );
}

export default async function FamilyPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family: key } = await params;
  const family = FAMILY_MAP[key as FamilyKey];
  if (!family) notFound();

  const [slots, admin] = await Promise.all([
    getStore()
      .listContentImageSlots()
      .catch(() => [] as string[]),
    isAdmin(),
  ]);
  const has = new Set(slots);

  const index = CRITERIA_FAMILIES.findIndex((f) => f.key === family.key);
  const prev = CRITERIA_FAMILIES[index - 1];
  const next = CRITERIA_FAMILIES[index + 1];

  return (
    <>
      <BackLink href="/learn/criteria" label="ארבע המשפחות" />
      <h1 className="mb-1 text-[24px] font-bold text-ink">{family.title}</h1>
      <p className="mb-5 text-[15px] text-ink-soft">{family.text}</p>

      <ul className="grid gap-3">
        {family.criteria.map((criterion) => {
          const Glyph = CRITERION_ICONS[criterion.key];
          const examples = EXAMPLES.filter((e) =>
            e.criterionKeys.includes(criterion.key),
          ).length;
          return (
            <li key={criterion.key} className="card flex items-start gap-3 p-4">
              <span className="mt-[2px] shrink-0 text-accent">
                <Glyph />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">{criterion.name}</p>
                <p className="mb-1 text-[14px] text-ink-soft">{criterion.text}</p>
                <Source criterion={criterion} />
                {examples > 0 ? (
                  <Link
                    href={`/examples?criterion=${criterion.key}`}
                    className="mt-1 inline-block text-[13px] text-accent underline underline-offset-2"
                  >
                    ראו דוגמאות ({examples})
                  </Link>
                ) : (
                  <p className="mt-1 text-[13px] text-ink-faint">
                    אין עדיין דוגמה בספרייה לקריטריון הזה.
                  </p>
                )}
                {/*
                  לכל קריטריון יש דוגמה אחת במסמך, ומפתח הדוגמה זהה למפתח
                  הקריטריון. לכן התמונה שנשלחת עם הבנייה משמשת גם כאן.
                */}
                <ImageFrame
                  className="mt-3"
                  slot={imageSlot("criterion", criterion.key)}
                  alt={`${criterion.name} — ${EXAMPLE_MAP[criterion.key]?.place ?? "תמונה להמחשה"}`}
                  hasImage={has.has(imageSlot("criterion", criterion.key))}
                  canEdit={admin}
                  ratio="16 / 9"
                  emptyLabel="אין עדיין תמונה לקריטריון"
                  fallbackSrc={
                    EXAMPLE_MAP[criterion.key] ? `/examples/${criterion.key}.jpg` : undefined
                  }
                  credit={EXAMPLE_MAP[criterion.key]?.place}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <PrevNext
        prev={prev ? { href: `/learn/criteria/${prev.key}`, label: prev.title } : undefined}
        next={next ? { href: `/learn/criteria/${next.key}`, label: next.title } : undefined}
      />
    </>
  );
}
