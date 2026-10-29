import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * יציאה מהצוות. קיימת כדי שאפשר יהיה לראות את האפליקציה בעיני תושב, ובלי
 * להישאר מחובר במכשיר משותף. ה-session נמחק בשרת של Supabase ובעוגיות.
 *
 * `Location` יחסי: כתובת מוחלטת שנבנית מ-request.url עלולה לשאת מארח אחר.
 */
export async function POST() {
  try {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Signing out of a session that is already gone is still a sign-out.
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/" } });
}
