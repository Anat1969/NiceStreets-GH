import { NextResponse } from "next/server";
import { loadCityData } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { streetStats } = await loadCityData();
  return NextResponse.json({
    streets: streetStats.map((s) => ({
      id: s.street.id,
      name: s.street.name,
      quarterId: s.street.quarterId,
      quarterName: s.quarterName,
      typology: s.street.typology,
      votes: s.votes,
      avgScore: s.avgScore,
      status: s.status?.status ?? null,
    })),
  });
}
