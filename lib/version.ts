/**
 * Which build is on screen.
 *
 * Without this, "I don't see the change" has no answer: every Vercel
 * deployment also keeps its own frozen address, so an old tab or an old
 * bookmark shows an old build forever, and looks exactly like a failed
 * deploy. The stamp below turns that into something anyone can check in a
 * second, without opening Vercel.
 */

const SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_COMMIT_SHA ?? "";

export const BUILD_SHA = SHA ? SHA.slice(0, 7) : "";

/** "גרסה 4cc9c63" in production, and honest about a local run. */
export const BUILD_LABEL = BUILD_SHA ? `גרסה ${BUILD_SHA}` : "הרצה מקומית";
