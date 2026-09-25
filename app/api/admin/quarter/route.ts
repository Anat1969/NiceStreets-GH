import { NextResponse } from "next/server";
import { QUARTER_MAP } from "@/lib/city";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Half-size of the box a staff click places, in degrees. */
const BOX_HALF_LON = 0.008;
const BOX_HALF_LAT = 0.0065;

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Staff calibration: place a quarter's box where it really is on the map. */
export async function POST(request: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const quarterId = body?.quarterId as string | undefined;
  const center = body?.center;

  if (!quarterId || !QUARTER_MAP[quarterId]) {
    return NextResponse.json({ error: "רובע לא מוכר" }, { status: 400 });
  }
  if (!isCoordinate(center)) {
    return NextResponse.json({ error: "נקודה לא תקינה" }, { status: 400 });
  }

  const [lon, lat] = center;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "נקודה מחוץ לטווח" }, { status: 400 });
  }

  // A click places a box of a fixed size around the point. The polygon is
  // stored, so it can later be replaced by the municipal GIS boundary.
  const polygon: [number, number][] = [
    [lon - BOX_HALF_LON, lat - BOX_HALF_LAT],
    [lon + BOX_HALF_LON, lat - BOX_HALF_LAT],
    [lon + BOX_HALF_LON, lat + BOX_HALF_LAT],
    [lon - BOX_HALF_LON, lat + BOX_HALF_LAT],
    [lon - BOX_HALF_LON, lat - BOX_HALF_LAT],
  ];

  try {
    const quarter = await getStore().setQuarterGeometry({
      quarterId,
      center: [lon, lat],
      polygon,
    });
    return NextResponse.json({ ok: true, quarter });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "השמירה נכשלה" },
      { status: 400 },
    );
  }
}
