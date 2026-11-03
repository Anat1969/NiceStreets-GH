import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getRole } from "@/lib/session";
import { getStore, getStoreConfigError } from "@/lib/store";
import { BUILD_SHA } from "@/lib/version";

export const dynamic = "force-dynamic";


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

    const config = {
      backend: store.kind,
      build: BUILD_SHA || "לא ידוע (הרצה מקומית)",
      supabaseUrl: SUPABASE_URL,
      // The publishable key is public by design; showing its prefix helps
      // tell a legacy anon key from the new format at a glance.
      publishableKey: `${SUPABASE_PUBLISHABLE_KEY.slice(0, 15)}…`,
      auth: "Supabase Auth — תושבים: כניסה אנונימית, צוות: קישור במייל",
      role: await getRole(),
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
