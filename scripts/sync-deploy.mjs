/**
 * Pushes the current work to both GitHub repositories, in the right order.
 *
 *   npm run sync
 *
 * Why this exists: Vercel deploys from `Anat1969/nicestreets-vercal`, not from
 * the main repository. A push to the main repository alone never reaches the
 * live site, and that has already happened more than once. The two
 * repositories have unrelated histories (the Vercel Deploy button created its
 * own), so the deploy repository is synchronised by copying the tracked files
 * of this repository's HEAD, not by merging.
 *
 * The path of the deploy clone can be overridden with DEPLOY_REPO.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const deployRepo = process.env.DEPLOY_REPO ?? "/home/user/nicestreets-vercal";

function git(cwd, args, { quiet = false } = {}) {
  const out = execFileSync("git", args, { cwd, encoding: "utf8" });
  if (!quiet && out.trim()) console.log(out.trim());
  return out.trim();
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

// 1. Nothing half-finished may be published.
if (git(root, ["status", "--porcelain"], { quiet: true })) {
  fail("יש שינויים שלא נשמרו ב-commit. לבצע commit לפני הסנכרון.");
}

const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"], { quiet: true });
const sha = git(root, ["rev-parse", "--short", "HEAD"], { quiet: true });
const subject = git(root, ["log", "-1", "--pretty=%s"], { quiet: true });

console.log(`ענף: ${branch}`);
console.log(`commit: ${sha} — ${subject}\n`);

// 2. The main repository: the branch, and main, which is what gets copied.
console.log("→ דחיפה למאגר הראשי");
git(root, ["push", "-u", "origin", branch]);
if (branch !== "main") {
  git(root, ["push", "origin", `${branch}:main`]);
}

// 3. The deploy repository: the one Vercel actually watches.
if (!existsSync(join(deployRepo, ".git"))) {
  fail(
    `לא נמצא עותק של מאגר הפריסה ב-${deployRepo}.\n` +
      "  git clone https://github.com/Anat1969/nicestreets-vercal " +
      `${deployRepo}\n  או להגדיר DEPLOY_REPO לנתיב אחר.`,
  );
}

console.log("\n→ העתקה למאגר הפריסה");
execFileSync(
  "bash",
  ["-c", `git -C ${JSON.stringify(root)} archive HEAD | tar -x -C ${JSON.stringify(deployRepo)}`],
  { stdio: "inherit" },
);

git(deployRepo, ["add", "-A"], { quiet: true });
if (!git(deployRepo, ["status", "--porcelain"], { quiet: true })) {
  console.log("אין הבדל בין המאגרים. שום דבר לא נדחף.");
} else {
  git(deployRepo, [
    "commit",
    "-m",
    `${subject}\n\nסנכרון מהמאגר הראשי Anat1969/NiceStreets-GH (${sha}).`,
  ], { quiet: true });
  git(deployRepo, ["push", "origin", "HEAD"]);
}

const deploySha = git(deployRepo, ["rev-parse", "--short", "HEAD"], { quiet: true });
console.log(`\n✓ המאגר הראשי: ${sha}`);
console.log(`✓ מאגר הפריסה: ${deploySha}`);
console.log("\nVercel מתחיל לבנות מעצמו. הכתובת שתמיד מציגה את האחרון:");
console.log("https://nicestreets-vercal.vercel.app");
console.log(`בתחתית המסך תופיע ${'"גרסה ' + deploySha + '"'} כשהבנייה תסתיים.`);
