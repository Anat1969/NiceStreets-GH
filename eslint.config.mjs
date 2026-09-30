import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * `next lint` is removed in Next 16 and, without a config, only ever opened an
 * interactive setup prompt — so `npm run lint` could never pass in CI or in a
 * script. This is the flat config it was missing; `npm run lint` now runs
 * ESLint directly.
 */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/vendor/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
