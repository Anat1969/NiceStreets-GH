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
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
