import { NextResponse } from "next/server";
import { QUARTER_MAP, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Staff assignment of the two things the national registry does not carry. */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const streetId = body?.streetId as string | undefined;
  if (!streetId) {
    return NextResponse.json({ error: "לא נבחר רחוב" }, { status: 400 });
  }

  const patch: { streetId: string; quarterId?: string | null; typology?: TypologyKey | null } = {
    streetId,
  };

  if (body?.quarterId !== undefined) {
    const value = body.quarterId === "" ? null : String(body.quarterId);
    if (value !== null && !QUARTER_MAP[value]) {
      return NextResponse.json({ error: "רובע לא מוכר" }, { status: 400 });
    }
    patch.quarterId = value;
  }

  if (body?.typology !== undefined) {
    const value = body.typology === "" ? null : String(body.typology);
    if (value !== null && !TYPOLOGY_MAP[value]) {
      return NextResponse.json({ error: "סוג רחוב לא מוכר" }, { status: 400 });
    }
    patch.typology = value as TypologyKey | null;
  }

  try {
    const street = await getStore().setStreetAssignment(patch);
    return NextResponse.json({ ok: true, street });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "העדכון נכשל" },
      { status: 400 },
    );
  }
}
