import { NextResponse } from "next/server";
import { QUESTIONS, TYPOLOGY_MAP } from "@/lib/city";
import type { TypologyKey } from "@/lib/city";
import { findCanonicalStreet, getStreetByCode } from "@/lib/streets";
import { getStore } from "@/lib/store";
import { RESIDENT_COOKIE, getResidentId, newResidentId } from "@/lib/session";
import type { Scores } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  /** Registry code of the chosen street; the canonical way to identify it. */
  streetCode?: string;
  /** Accepted as a fallback and resolved through the registry. */
  streetName?: string;
  scores?: Record<string, unknown>;
  reason?: string;
  typologySuggestion?: string | null;
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

  // Only a street from the national registry is accepted, so three spellings
  // of the same street can never become three records.
  const canonical = body.streetCode
    ? getStreetByCode(body.streetCode)
    : findCanonicalStreet(body.streetName ?? "");
  if (!canonical) {
    return NextResponse.json(
      { error: "יש לבחור רחוב מתוך רשימת הרחובות" },
      { status: 400 },
    );
  }

  const suggestion = body.typologySuggestion;
  if (suggestion && !TYPOLOGY_MAP[suggestion]) {
    return NextResponse.json({ error: "סוג הרחוב אינו מוכר" }, { status: 400 });
  }

  const reason = (body.reason ?? "").toString().trim().slice(0, 600);
  const store = getStore();
  const existingId = await getResidentId();
  const userId = existingId ?? newResidentId();

  try {
    const street = await store.createStreet({
      code: canonical.code,
      name: canonical.name,
    });
    const vote = await store.upsertVote({
      streetId: street.id,
      scores,
      reason,
      userId,
      typologySuggestion: (suggestion as TypologyKey) ?? null,
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
