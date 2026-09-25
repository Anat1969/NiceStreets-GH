import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";
import { Card, Section } from "@/components/ui";
import PhotoModeration from "@/components/PhotoModeration";

export const dynamic = "force-dynamic";

export default async function PhotoQueuePage() {
  // Not a login screen: an address that is not for the public simply does not
  // exist for it.
  if (!(await isStaff())) notFound();

  const store = getStore();
  const [photos, streets] = await Promise.all([
    store.listPhotos().catch(() => []),
    store.listStreets().catch(() => []),
  ]);
  const streetName = new Map(streets.map((s) => [s.id, s.name]));

  const pending = photos
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = photos
    .filter((p) => p.status !== "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return (
    <>
      <p className="mb-1 text-[13px] text-ink-faint">
        <Link href="/admin" className="underline underline-offset-2">
          לוח בקרה
        </Link>{" "}
        · תור תמונות
      </p>
      <h1 className="mb-1 text-[24px] font-bold text-ink">תור תמונות</h1>
      <p className="mb-5 text-[14px] text-ink-soft">
        תמונה מתפרסמת לציבור רק אחרי אישור. בדקו שאין בה פנים מזוהות או לוחיות
        רישוי, ושהיא אכן מצולמת ברחוב שצוין.
      </p>

      <Section
        title={pending.length > 0 ? `ממתינות לאישור (${pending.length})` : "ממתינות לאישור"}
      >
        <PhotoModeration
          photos={pending.map((p) => ({
            id: p.id,
            streetId: p.streetId,
            streetName: streetName.get(p.streetId) ?? "רחוב לא ידוע",
            createdAt: p.createdAt,
          }))}
        />
      </Section>

      <Section title="הוכרעו לאחרונה" note="אפשר לשנות החלטה בכל עת.">
        {decided.length === 0 ? (
          <Card>
            <p className="text-[14px] text-ink-soft">עדיין לא הוכרעו תמונות.</p>
          </Card>
        ) : (
          <PhotoModeration
            decided
            photos={decided.map((p) => ({
              id: p.id,
              streetId: p.streetId,
              streetName: streetName.get(p.streetId) ?? "רחוב לא ידוע",
              createdAt: p.createdAt,
              status: p.status,
            }))}
          />
        )}
      </Section>
    </>
  );
}
