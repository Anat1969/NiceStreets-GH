import { notFound } from "next/navigation";
import Link from "next/link";
import { QUESTIONS, TYPOLOGY_MAP } from "@/lib/city";
import { getStore } from "@/lib/store";
import { buildStreetStats, voteScore } from "@/lib/stats";
import { isStaff } from "@/lib/session";
import { Card, Notice, ScoreBar, Section, StatusBadge } from "@/components/ui";
import StatusEditor from "@/components/StatusEditor";

export const dynamic = "force-dynamic";

export default async function StreetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const store = getStore();

  const [street, votes, photos, statuses, quarters, staff] = await Promise.all([
    store.getStreet(id),
    store.listVotes({ streetId: id }),
    store.listPhotos({ streetId: id }),
    store.listStreetStatuses(),
    store.listQuarters(),
    isStaff(),
  ]);
  if (!street) notFound();

  const [stats] = buildStreetStats([street], votes, photos, statuses, quarters);
  const visiblePhotos = photos.filter((p) => p.status === "approved" || staff);
  const reasons = votes
    .filter((v) => v.reason.trim().length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const typology = TYPOLOGY_MAP[street.typology];

  return (
    <>
      {saved ? (
        <p role="status" className="mb-4 rounded-[12px] bg-accent-soft px-3 py-2 text-[15px] text-accent">
          הקול שלכם נשמר. תודה.
        </p>
      ) : null}

      <h1 className="text-[26px] font-bold text-ink">{street.name}</h1>
      <p className="mb-4 text-[14px] text-ink-soft">
        {stats.quarterName} · {typology?.label ?? street.typology}
      </p>

      <div className="mb-5 flex gap-2">
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-semibold tabular-nums text-accent">{stats.votes}</div>
          <div className="text-[13px] text-ink-soft">קולות</div>
        </div>
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-semibold tabular-nums text-accent">
            {stats.avgScore === null ? "—" : stats.avgScore.toFixed(1)}
          </div>
          <div className="text-[13px] text-ink-soft">ציון ממוצע</div>
        </div>
        <div className="card flex-1 p-3 text-center">
          <div className="text-[24px] font-semibold tabular-nums text-accent">
            {visiblePhotos.filter((p) => p.status === "approved").length}
          </div>
          <div className="text-[13px] text-ink-soft">תמונות</div>
        </div>
      </div>

      <Section title="פילוח לפי שאלות">
        <Card>
          {QUESTIONS.map((question) => (
            <ScoreBar
              key={question.key}
              label={question.label}
              value={stats.perQuestion[question.key]}
            />
          ))}
        </Card>
      </Section>

      {typology ? (
        <Section title="ערכי ייחוס לסוג הרחוב" note={typology.description}>
          <Card>
            <dl className="grid grid-cols-3 gap-2 text-[13px]">
              <div>
                <dt className="text-ink-faint">רוחב זכות דרך</dt>
                <dd className="text-ink">{typology.benchmarks.rowWidth}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">יחס גובה־רוחב</dt>
                <dd className="text-ink">{typology.benchmarks.ratio}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">חופת עצים</dt>
                <dd className="text-ink">{typology.benchmarks.canopy}</dd>
              </div>
            </dl>
            {street.gis ? (
              <p className="mt-2 border-t border-line pt-2 text-[13px] text-ink-soft">
                נתוני GIS לרחוב:
                {street.gis.rowWidthM ? ` רוחב ${street.gis.rowWidthM} מ'` : ""}
                {street.gis.canopyPct ? ` · חופת עצים ${street.gis.canopyPct}%` : ""}
                {street.gis.intersectionDistanceM
                  ? ` · מרחק בין צמתים ${street.gis.intersectionDistanceM} מ'`
                  : ""}
              </p>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section title="גלריה" note={staff ? "הצוות רואה גם תמונות שממתינות לאישור." : undefined}>
        {visiblePhotos.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">עדיין אין תמונות מאושרות לרחוב הזה.</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {visiblePhotos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-[12px] border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${photo.id}`}
                  alt={`תמונה מהרחוב ${street.name}`}
                  className="h-32 w-full object-cover"
                />
                {photo.status !== "approved" ? (
                  <p className="px-2 py-1 text-[12px] text-ink-faint">
                    {photo.status === "pending" ? "ממתינה לאישור" : "נדחתה"}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="מה התושבים כתבו">
        {reasons.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">עדיין אין נימוקים.</p>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {reasons.map((vote) => (
              <li key={vote.id} className="card p-3">
                <p className="text-[15px] text-ink">{vote.reason}</p>
                <p className="mt-1 text-[12px] text-ink-faint">
                  ציון הקול: {voteScore(vote).toFixed(1)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="סטטוס עירוני">
        <Card>
          <StatusBadge status={stats.status?.status ?? null} />
          {stats.status?.publicNote ? (
            <p className="mt-2 text-[15px] text-ink">{stats.status.publicNote}</p>
          ) : null}
          {stats.status ? (
            <p className="mt-1 text-[12px] text-ink-faint">
              עודכן ב־{new Date(stats.status.updatedAt).toLocaleDateString("he-IL")}
            </p>
          ) : null}
          {staff ? (
            <div className="mt-3 border-t border-line pt-3">
              <StatusEditor
                streetId={street.id}
                current={stats.status?.status ?? null}
                note={stats.status?.publicNote ?? ""}
              />
            </div>
          ) : null}
        </Card>
      </Section>

      <div className="mb-6 grid gap-2">
        <Link
          href="/choose"
          className="flex items-center justify-center rounded-[14px] bg-accent px-5 py-3 text-[16px] font-medium text-white"
        >
          לדרג את הרחוב הזה
        </Link>
        <Link
          href="/streets"
          className="flex items-center justify-center rounded-[14px] border border-line bg-surface px-5 py-3 text-[16px] text-ink"
        >
          חזרה לרשימת הרחובות
        </Link>
      </div>

      {!street.verified ? (
        <Notice>הרחוב טרם אומת מול שכבת ה־GIS העירונית.</Notice>
      ) : null}
    </>
  );
}
