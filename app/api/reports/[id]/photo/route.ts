import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * התמונה של דיווח, לצוות בלבד ותמיד.
 *
 * בשונה מתמונה של קול, לתמונה כאן אין מסלול לפרסום: היא ראיה בפנייה לאגף.
 * לכן אין כאן בדיקת מצב אישור אלא בדיקת תפקיד, ואין שמירה במטמון.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isStaff())) return new NextResponse("אין הרשאה", { status: 403 });
  const { id } = await params;
  const file = await getStore()
    .readReportPhoto(id)
    .catch(() => null);
  if (!file) return new NextResponse("לא נמצא", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: { "content-type": file.contentType, "cache-control": "no-store" },
  });
}
