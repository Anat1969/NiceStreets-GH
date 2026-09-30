/**
 * Shared by the client toggle and the server layout, so it must not import
 * anything server-only.
 */
export const PALETTE_COOKIE = "gs_palette";

/** "green" is the default scheme; "blue" is dark blue on a light background. */
export type Palette = "green" | "blue";

export function parsePalette(value: string | undefined): Palette {
  return value === "blue" ? "blue" : "green";
}

export const PALETTES: { value: Palette; label: string }[] = [
  { value: "green", label: "ירוק" },
  { value: "blue", label: "כחול" },
];

/**
 * The colour the browser paints its own chrome with — the address bar on
 * Android, the status bar in a standalone PWA. It has to follow the chosen
 * scheme, otherwise a blue app sits under a green bar.
 */
export const PALETTE_THEME_COLOR: Record<Palette, string> = {
  green: "#1f6f5c",
  blue: "#1b3f78",
};
