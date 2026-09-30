import { NextResponse } from "next/server";
import { STAFF_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * יציאה מהצוות. קיימת כדי שאפשר יהיה לראות את האפליקציה בעיני תושב בלי
 * לנקות עוגיות ביד, ובלי להישאר מחובר במכשיר משותף.
 *
 * `Location` יחסי, מאותה סיבה שבכניסה: כתובת מוחלטת שנבנית מ-request.url
 * עלולה לשאת מארח אחר, והעוגייה שמתבטלת כאן שייכת למארח שממנו הגיע הגולש.
 */
export async function POST() {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/" },
  });
  response.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
