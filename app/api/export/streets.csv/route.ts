import { NextResponse } from "next/server";
import { QUESTIONS, STATUS_MAP, TYPOLOGY_MAP } from "@/lib/city";
import { loadCityData } from "@/lib/data";
import { applyStreetFilter, parseStreetFilter } from "@/lib/street-filter";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  if (!(await isStaff())) {
    return new NextResponse("אין הרשאה", { status: 403 });
  }
  const { streetStats } = await loadCityData();

  // The export must describe exactly the rows the screen is showing.
  const filter = parseStreetFilter(new URL(request.url).searchParams);
  const rows = applyStreetFilter(
    streetStats.map((s) => ({
      name: s.street.name,
      quarterId: s.street.quarterId,
      typology: s.street.typology,
      status: s.status?.status ?? null,
      votes: s.votes,
      avgScore: s.avgScore,
      photos: s.photos,
      source: s,
    })),
    filter,
  ).map((row) => row.source);
  const header = [
    "street_id",
    "street",
    "quarter",
    "typology",
    "votes",
    "avg_score",
    ...QUESTIONS.map((q) => `q_${q.key}`),
    "photos",
    "status",
    "public_note",
    "updated_at",
  ];
  const csvRows = rows.map((s) => [
    s.street.id,
    s.street.name,
    s.quarterName,
    s.street.typology ? (TYPOLOGY_MAP[s.street.typology]?.label ?? s.street.typology) : "טרם סווג",
    s.votes,
    s.avgScore === null ? null : s.avgScore.toFixed(2),
    ...QUESTIONS.map((q) => {
      const value = s.perQuestion[q.key];
      return value === null ? null : value.toFixed(2);
    }),
    s.photos,
    s.status ? STATUS_MAP[s.status.status].label : "",
    s.status?.publicNote ?? "",
    s.status?.updatedAt ?? "",
  ]);
  const csv = [header, ...csvRows].map((row) => row.map(cell).join(",")).join("\n");
  // BOM so Excel opens the Hebrew columns correctly.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="good-streets-ashdod.csv"',
    },
  });
}
