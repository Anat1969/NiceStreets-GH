/**
 * Shared by the client toggle and the server layout, so it must not import
 * anything server-only.
 */
export const VIEW_MODE_COOKIE = "gs_view";

/** "auto" follows the screen width; the other two are a deliberate override. */
export type ViewMode = "auto" | "desktop" | "mobile";

export function parseViewMode(value: string | undefined): ViewMode {
  return value === "desktop" || value === "mobile" ? value : "auto";
}
