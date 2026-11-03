import { NextResponse } from "next/server";
import { isStaff } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Runs the automated audit: one street ({ streetId }) or all ({ all: true }).
 *
 * The run itself happens in the database (run_street_audit), which checks
 * again that the caller is staff. Every run is a new version; nothing is
 * overwritten, and nothing reaches the public until staff approve it.
 */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "הבדיקה האוטומטית שמורה לצוות" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as
    | { streetId?: string; all?: boolean }
    | null;
  if (!body || (!body.all && !body.streetId)) {
    return NextResponse.json({ error: "חסר רחוב לבדיקה" }, { status: 400 });
  }

  try {
    const db = await supabaseServer();
    if (body.all) {
      const { data, error } = await db.rpc("run_all_street_audits", { p_run_by: "staff" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, count: data });
    }
    const { data, error } = await db.rpc("run_street_audit", {
      p_street_id: body.streetId,
      p_run_by: "staff",
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, auditId: data, count: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error:
          message === "STAFF_ONLY"
            ? "מסד הנתונים לא זיהה אותך כצוות. נסו לצאת ולהיכנס שוב."
            : `הבדיקה נכשלה: ${message}`,
      },
      { status: message === "STAFF_ONLY" ? 403 : 500 },
    );
  }
}
