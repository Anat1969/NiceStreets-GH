import Link from "next/link";
import ReportForm from "@/components/ReportForm";
import { Notice } from "@/components/ui";
import { CITY } from "@/lib/city";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "דיווח לעירייה — הרחובות הטובים של אשדוד" };

/**
 * דיווח על משהו שקרה ברחוב.
 *
 * הכניסה לכאן היא מכרטיס הרחוב, ולכן הרחוב ידוע. דיווח בלי רחוב אינו
 * דיווח שאפשר לטפל בו, ולכן בלי המזהה המסך מפנה חזרה לרשימת הרחובות
 * במקום לבקש מהתושב להקליד שם שאולי אינו קיים.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ street?: string }>;
}) {
  const { street: streetId } = await searchParams;
  const street = streetId
    ? await getStore()
        .getStreet(streetId)
        .catch(() => null)
    : null;

  return (
    <>
      <h1 className="mb-1 text-[24px] font-bold text-ink">דיווח לעירייה</h1>
      <p className="mb-4 text-[15px] text-ink-soft">
        משהו ברחוב שדורש טיפול — מדרכה שבורה, עץ שנעלם, מקום שאי אפשר לעבור בו.
        הדיווח מגיע ל{CITY.authority}.
      </p>

      {street ? (
        <>
          <p className="mb-4 text-[15px] text-ink">
            הדיווח על{" "}
            <Link
              href={`/street/${street.id}`}
              className="inline-link font-medium text-accent underline underline-offset-2"
            >
              {street.name}
            </Link>
            .
          </p>
          <ReportForm kind="issue" streetId={street.id} streetName={street.name} quarters={[]} />
        </>
      ) : (
        <Notice>
          כדי לדווח צריך לבחור קודם את הרחוב.{" "}
          <Link
            href="/streets"
            className="inline-link text-accent underline underline-offset-2"
          >
            לטבלת הרחובות
          </Link>
          , ומשם בכרטיס הרחוב יש כפתור דיווח. רחוב שאינו ברשימה הרשמית —{" "}
          <Link
            href="/suggest"
            className="inline-link text-accent underline underline-offset-2"
          >
            להצעת רחוב
          </Link>
          .
        </Notice>
      )}
    </>
  );
}
