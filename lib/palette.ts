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
