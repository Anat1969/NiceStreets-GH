import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { parseImageSlot } from "@/lib/content-images";

export const dynamic = "force-dynamic";

/** הבייטים של תמונת תוכן. ציבורי: אלה תמונות של האגף, לא של תושבים. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  const { slot: raw } = await params;
  const slot = parseImageSlot(decodeURIComponent(raw));
  if (!slot) return new NextResponse(null, { status: 404 });

  const image = await getStore()
    .readContentImage(slot)
    .catch(() => null);
  if (!image) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(image.body), {
    headers: {
      "content-type": image.contentType,
      // התמונה מתחלפת בהעלאה, ולכן קאש קצר ולא שנה.
      "cache-control": "public, max-age=300",
    },
  });
}
