import { NextResponse } from "next/server";
import { QUARTER_MAP } from "@/lib/city";
import { getStore } from "@/lib/store";
import { getResidentId } from "@/lib/session";
import type { ReportKind } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * שני המסלולים שבהם תמונה היא חובה.
 *
 * "issue" — דיווח לעירייה על משהו שקרה ברחוב קיים.
 * "street_suggestion" — הצעת רחוב שאינו ברשימת הרחובות הרשמית.
 *
 * כאן התמונה אינה רשות, ולכן הבקשה נדחית בלעדיה. זה ההפך מהדירוג, ומכוון:
 * שם התמונה הייתה מכשול בפני קול, וכאן היא הראיה עצמה — בלעדיה אין לצוות
 * מה לבדוק.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    kind?: string;
    streetId?: string | null;
    streetName?: string;
    quarterId?: string | null;
    body?: string;
    dataUrl?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const kind = body.kind;
  if (kind !== "issue" && kind !== "street_suggestion") {
    return NextResponse.json({ error: "סוג הפנייה אינו מוכר" }, { status: 400 });
  }

  if (!body.dataUrl) {
    return NextResponse.json(
      {
        error:
          kind === "issue"
            ? "לדיווח יש לצרף תמונה. התמונה היא מה שמאפשר לאגף לראות מה קרה."
            : "להצעת רחוב יש לצרף תמונה, כדי שהצוות יזהה על איזה מקום מדובר.",
      },
      { status: 400 },
    );
  }

  const text = (body.body ?? "").toString().trim().slice(0, 900);
  if (text.length < 5) {
    return NextResponse.json(
      { error: "כתבו במשפט אחד לפחות מה ראיתם." },
      { status: 400 },
    );
  }

  const store = getStore();
  let streetId: string | null = null;
  let streetName = (body.streetName ?? "").toString().trim().slice(0, 120);

  if (kind === "issue") {
    // דיווח תמיד שייך לרחוב שכבר קיים במסד — הכניסה אליו היא מכרטיס הרחוב.
    const street = body.streetId
      ? await store.getStreet(body.streetId).catch(() => null)
      : null;
    if (!street) {
      return NextResponse.json({ error: "הרחוב לא נמצא" }, { status: 400 });
    }
    streetId = street.id;
    streetName = street.name;
  } else if (!streetName) {
    return NextResponse.json({ error: "יש לכתוב את שם הרחוב." }, { status: 400 });
  }

  const quarterId =
    body.quarterId && body.quarterId in QUARTER_MAP ? body.quarterId : null;

  // הדפדפן מחבר את התושב אנונימית לפני השליחה, והדיווח שייך לזהות הזאת.
  const userId = await getResidentId();
  if (!userId) {
    return NextResponse.json(
      { error: "הזיהוי האנונימי חסר. רעננו את הדף ונסו שוב.", needSession: true },
      { status: 401 },
    );
  }

  try {
    const report = await store.createReport({
      kind: kind as ReportKind,
      streetId,
      streetName,
      quarterId,
      body: text,
      userId,
      dataUrl: body.dataUrl,
    });
    return NextResponse.json({ ok: true, reportId: report.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      PHOTO_FORMAT: "פורמט התמונה אינו נתמך",
      PHOTO_TOO_LARGE: "התמונה גדולה מדי. נסו שוב עם תמונה קטנה יותר",
    };
    return NextResponse.json(
      { error: messages[code] ?? "שמירת הפנייה נכשלה" },
      { status: code in messages ? 400 : 500 },
    );
  }
}
