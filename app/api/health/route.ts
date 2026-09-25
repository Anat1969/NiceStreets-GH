import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Diagnostics for the deployment. Open /api/health in a browser.
 * It reports which storage backend is live and whether it answers, and
 * deliberately exposes no keys — only whether they are configured.
 */
export async function GET() {
  const store = getStore();
  const config = {
    backend: store.kind,
    supabaseUrlSet: Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKeySet: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY,
    ),
    staffCodeSet: Boolean(process.env.STAFF_CODE),
  };

  const checks: Record<string, { ok: boolean; count?: number; error?: string }> = {};

  async function check(name: string, run: () => Promise<{ length: number }>) {
    try {
      const rows = await run();
      checks[name] = { ok: true, count: rows.length };
    } catch (error) {
      checks[name] = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  await check("quarters", () => store.listQuarters());
  await check("streets", () => store.listStreets());
  await check("votes", () => store.listVotes());
  await check("photos", () => store.listPhotos());
  await check("street_status", () => store.listStreetStatuses());

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    {
      ok,
      durableStorage: store.kind === "supabase",
      config,
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
