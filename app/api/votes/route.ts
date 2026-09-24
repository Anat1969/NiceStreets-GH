import { NextResponse } from "next/server";
import { QUESTIONS, TYPOLOGY_MAP, QUARTER_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { getStore } from "@/lib/store";
import { RESIDENT_COOKIE, getResidentId, newResidentId } from "@/lib/session";
import type { Scores } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  streetId?: string;
  newStreet?: { name: string; quarterId: string; typology: string };
  scores?: Record<string, unknown>;
  reason?: string;
  photo?: string | null;
}

function parseScores(raw: Record<string, unknown> | undefined): Scores | null {
  if (!raw) return null;
  const scores = {} as Scores;
  for (const question of QUESTIONS) {
    const value = Number(raw[question.key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) return null;
    scores[question.key] = value;
  }
  return scores;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });

  const scores = parseScores(body.scores);
  if (!scores) {
    return NextResponse.json(
      { error: "יש לדרג את כל שבע השאלות בסולם 1–5" },
      { status: 400 },
    );
  }

  const reason = (body.reason ?? "").toString().trim().slice(0, 600);
  const store = getStore();

  let streetId = body.streetId;
  if (!streetId && body.newStreet) {
    const { name, quarterId, typology } = body.newStreet;
    if (!name?.trim() || !QUARTER_MAP[quarterId] || !TYPOLOGY_MAP[typology]) {
      return NextResponse.json({ error: "פרטי הרחוב חסרים או לא תקינים" }, { status: 400 });
    }
    const street = await store.createStreet({
      name,
      quarterId,
      typology: typology as TypologyKey,
    });
    streetId = street.id;
  }

  if (!streetId) {
    return NextResponse.json({ error: "לא נבחר רחוב" }, { status: 400 });
  }

  const existingId = await getResidentId();
  const userId = existingId ?? newResidentId();

  try {
    const vote = await store.upsertVote({
      streetId,
      scores,
      reason,
      userId,
      photo: body.photo ? { dataUrl: body.photo } : null,
    });
    const response = NextResponse.json({
      ok: true,
      streetId: vote.streetId,
      updated: vote.createdAt !== vote.updatedAt,
    });
    if (!existingId) {
      response.cookies.set(RESIDENT_COOKIE, userId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const messages: Record<string, string> = {
      STREET_NOT_FOUND: "הרחוב לא נמצא",
      PHOTO_FORMAT: "פורמט התמונה אינו נתמך",
      PHOTO_TOO_LARGE: "התמונה גדולה מדי",
    };
    return NextResponse.json(
      { error: messages[code] ?? "שמירת הקול נכשלה" },
      { status: code in messages ? 400 : 500 },
    );
  }
}
