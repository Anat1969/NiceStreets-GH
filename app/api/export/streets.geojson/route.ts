import { NextResponse } from "next/server";
import { QUESTIONS, TYPOLOGY_MAP } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isStaff())) {
    return new NextResponse("אין הרשאה", { status: 403 });
  }
  const { streetStats } = await loadCityData();
  const features = streetStats
    .filter((s) => s.street.line && s.street.line.length > 1)
    .map((s) => ({
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: s.street.line },
      properties: {
        street_id: s.street.id,
        name: s.street.name,
        quarter: s.quarterName,
        typology: s.street.typology
          ? (TYPOLOGY_MAP[s.street.typology]?.label ?? s.street.typology)
          : null,
        votes: s.votes,
        avg_score: s.avgScore,
        ...Object.fromEntries(QUESTIONS.map((q) => [`q_${q.key}`, s.perQuestion[q.key]])),
        status: s.status?.status ?? null,
        public_note: s.status?.publicNote ?? null,
        geometry_source: "schematic-placeholder",
      },
    }));
  return new NextResponse(
    JSON.stringify({ type: "FeatureCollection", features }, null, 2),
    {
      headers: {
        "content-type": "application/geo+json; charset=utf-8",
        "content-disposition": 'attachment; filename="good-streets-ashdod.geojson"',
      },
    },
  );
}
