import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { Card, Section } from "@/components/ui";
import ReportHandled from "@/components/ReportHandled";
import { QUARTER_MAP } from "@/lib/city";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "דיווחים והצעות — הרחובות הטובים של אשדוד" };

function ReportCard({ report }: { report: Report }) {
  const quarter = report.quarterId ? QUARTER_MAP[report.quarterId]?.name : null;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[16px] font-semibold text-ink">
          {report.streetName || "רחוב בלי שם"}
        </p>
        <span className="text-[12px] text-ink-faint">
          {new Date(report.createdAt).toLocaleDateString("he-IL")}
        </span>
      </div>
      <p className="text-[13px] text-ink-faint">
        {report.kind === "issue" ? "דיווח לעירייה" : "הצעת רחוב שאינו ברשימה"}
        {quarter ? ` · ${quarter}` : ""}
      </p>

      {/*
        התמונה היא הראיה, ולכן היא גדולה וראשונה. היא מוגשת מנתיב שבודק
        תפקיד בכל בקשה, ואינה מתפרסמת בשום מסך ציבורי.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/reports/${report.id}/photo`}
        alt={`התמונה שצורפה לדיווח על ${report.streetName}`}
        className="mt-2 max-h-72 w-full rounded-[12px] object-cover"
      />

      <p className="mt-2 whitespace-pre-line text-[15px] text-ink">{report.body}</p>

      {report.streetId ? (
        <Link
          href={`/street/${report.streetId}`}
          className="inline-link mt-2 inline-block text-[14px] text-accent underline underline-offset-2"
        >
          לכרטיס הרחוב
        </Link>
      ) : null}

      <div className="mt-3">
        <ReportHandled reportId={report.id} handled={report.handled} />
      </div>
    </Card>
  );
}

export default async function ReportsPage() {
  // אינו מסך התחברות: כתובת שאינה לציבור פשוט אינה קיימת בעבורו.
  if (!(await isStaff())) notFound();

  const reports = await getStore()
    .listReports()
    .catch(() => []);
  const open = reports.filter((r) => !r.handled);
  const handled = reports.filter((r) => r.handled).slice(0, 12);

  return (
    <>
      <p className="mb-1 text-[13px] text-ink-faint">
        <Link href="/admin" className="inline-link underline underline-offset-2">
          לוח בקרה
        </Link>{" "}
        · דיווחים והצעות
      </p>
      <h1 className="mb-1 text-[24px] font-bold text-ink">דיווחים והצעות</h1>
      <p className="mb-5 text-[14px] text-ink-soft">
        שני המסלולים שבהם התושב חייב לצרף תמונה: דיווח על משהו שקרה ברחוב, והצעת
        רחוב שאינו ברשימה הרשמית. אלה אינם קולות — הם אינם משנים ציון ואינם
        מופיעים בשום מסך ציבורי, וגם התמונה שלהם אינה מתפרסמת.
      </p>

      <Section title={open.length > 0 ? `פתוחים (${open.length})` : "פתוחים"}>
        {open.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">אין דיווחים פתוחים.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {open.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </Section>

      {handled.length > 0 ? (
        <Section title="טופלו לאחרונה" note="אפשר להחזיר דיווח לפתוחים בכל עת.">
          <div className="grid gap-3">
            {handled.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}
