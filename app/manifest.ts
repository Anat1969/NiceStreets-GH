import type { MetadataRoute } from "next";
import { CITY } from "@/lib/city";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: CITY.appTitle,
    short_name: CITY.appShortTitle,
    description: CITY.tagline,
    lang: "he",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#1f6f5c",
    /*
     * דפדפנים ניידים דורשים PNG בגודל 192 ו-512 כדי להציע התקנה; SVG לבדו
     * אינו מספיק, ובלעדיהם הכפתור "הוספה למסך הבית" פשוט לא מופיע.
     * הקבצים נוצרים מ-app/icon.svg — ראו scripts/build-icons.mjs.
     */
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
