import { NextResponse } from "next/server";
import { QUARTER_MAP, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/*
 * אישור השיוך האוטומטי לכמה רחובות בבת אחת ("לאשר הכול" בשולחן העבודה).
 * כל שורה עוברת את אותה בדיקה כמו /api/admin/street, והכתיבה עוברת דרך
 * הרשאת הצוות במסד (RLS) — אין כאן מפתח עוקף.
 */
interface Item {
  streetId: string;
  quarterId?: string;
  typology?: string;
}

export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const items = Array.isArray(body?.items) ? (body.items as Item[]) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "אין מה לשמור" }, { status: 400 });
  }
  if (items.length > 1000) {
    return NextResponse.json({ error: "יותר מדי רחובות בבקשה אחת" }, { status: 400 });
  }

  const store = getStore();
  let saved = 0;
  const failed: string[] = [];
  for (const item of items) {
    if (!item?.streetId) continue;
    const patch: { streetId: string; quarterId?: string; typology?: TypologyKey } = {
      streetId: String(item.streetId),
    };
    if (item.quarterId && QUARTER_MAP[item.quarterId]) patch.quarterId = item.quarterId;
    if (item.typology && TYPOLOGY_MAP[item.typology]) patch.typology = item.typology as TypologyKey;
    if (patch.quarterId === undefined && patch.typology === undefined) continue;
    try {
      await store.setStreetAssignment(patch);
      saved++;
    } catch {
      failed.push(patch.streetId);
    }
  }
  return NextResponse.json({ ok: failed.length === 0, saved, failed: failed.length });
}
