import { NextResponse } from "next/server";
import { getStore, getStoreConfigError } from "@/lib/store";

export const dynamic = "force-dynamic";

function describe(value: string | undefined): string {
  if (value === undefined) return "לא מוגדר";
  const trimmed = value.trim();
  if (trimmed === "") return "מוגדר אך ריק";
  const notes: string[] = [`אורך ${trimmed.length}`];
  if (value !== trimmed) notes.push("יש רווחים או שורה מיותרת בקצוות");
  if (/\s/.test(trimmed)) notes.push("יש רווח או ירידת שורה באמצע הערך");
  return notes.join(", ");
}

/**
 * Diagnostics for the deployment. Open /api/health in a browser.
 *
 * It reports which storage backend is live and whether it answers. It must
 * never throw, because it is the tool for diagnosing a broken deployment.
 * It describes the environment variables without revealing their values.
 */
export async function GET() {
  try {
    const store = getStore();
    const configError = getStoreConfigError();

    const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

    const config = {
      backend: store.kind,
      SUPABASE_URL: describe(rawUrl),
      SUPABASE_URL_looksLikeUrl: (rawUrl ?? "").trim().startsWith("https://"),
      SUPABASE_SERVICE_ROLE_KEY: describe(rawKey),
      STAFF_CODE: describe(process.env.STAFF_CODE),
      configError,
    };

    const checks: Record<string, { ok: boolean; count?: number; error?: string }> = {};

    async function check(name: string, run: () => Promise<{ length: number }>) {
      try {
        const rows = await run();
        checks[name] = { ok: true, count: rows.length };
      } catch (error) {
        checks[name] = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await check("quarters", () => store.listQuarters());
    await check("streets", () => store.listStreets());
    await check("votes", () => store.listVotes());
    await check("photos", () => store.listPhotos());
    await check("street_status", () => store.listStreetStatuses());

    const ok = !configError && Object.values(checks).every((c) => c.ok);
    return NextResponse.json(
      { ok, durableStorage: store.kind === "supabase", config, checks },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        fatal: error instanceof Error ? error.message : String(error),
      },
      { status: 200 },
    );
  }
}
