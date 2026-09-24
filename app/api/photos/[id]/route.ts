import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { isStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const [photos, staff] = await Promise.all([store.listPhotos(), isStaff()]);
  const photo = photos.find((p) => p.id === id);
  if (!photo) return new NextResponse("לא נמצא", { status: 404 });
  // Pending and rejected photos are visible to staff only.
  if (photo.status !== "approved" && !staff) {
    return new NextResponse("אין הרשאה", { status: 403 });
  }
  const file = await store.readPhoto(id);
  if (!file) return new NextResponse("לא נמצא", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "content-type": file.contentType,
      "cache-control": photo.status === "approved" ? "public, max-age=3600" : "no-store",
    },
  });
}
