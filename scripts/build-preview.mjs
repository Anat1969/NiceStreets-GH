/**
 * בונה את preview/: דף סטטי של חתך הרחוב, שמוגש ישירות מ-GitHub דרך raw.githack.
 *   npm run build && node scripts/build-preview.mjs
 * ה-CSS נלקח מהבנייה של Next (Tailwind כבר מקומפל שם), והרכיב נארז עם esbuild.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const out = join(root, "preview");
const cssDir = join(root, ".next/static/css");
const css = readdirSync(cssDir).filter((f) => f.endsWith(".css"));
if (css.length === 0) throw new Error("אין CSS ב-.next/static/css. להריץ קודם npm run build.");
css.forEach((f, i) => copyFileSync(join(cssDir, f), join(out, `app-${i}.css`)));

execFileSync(
  "npx",
  [
    "--yes",
    "esbuild@0.24.0",
    "preview/entry.tsx",
    "--bundle",
    "--minify",
    "--format=esm",
    "--jsx=automatic",
    "--outfile=preview/app.js",
    "--alias:next/navigation=./preview/router-stub.ts",
    "--define:process.env.NODE_ENV=\"production\"",
    "--loader:.json=json",
  ],
  { cwd: root, stdio: "inherit" },
);

const links = css.map((_, i) => `<link rel="stylesheet" href="./app-${i}.css">`).join("\n    ");
writeFileSync(
  join(out, "index.html"),
  `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>חתך הרחוב, תצוגה מקדימה</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&display=swap">
    ${links}
  </head>
  <body class="bg-paper">
    <div id="root"></div>
    <script type="module" src="./app.js"></script>
  </body>
</html>
`,
);
console.log("preview/index.html נבנה.");
