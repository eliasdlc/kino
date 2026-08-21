import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Service worker y compañía: los escribe next-pwa dentro de `public/` en
    // cada build (KIN-57). Es bundle de Workbox, no código nuestro, y sin esto
    // `pnpm lint` pasa de 1 aviso a 113 según si acabas de buildear o no.
    "public/sw.js",
    "public/workbox-*.js",
    "public/swe-worker-*.js",
    "public/worker-*.js",
    "public/fallback-*.js",
  ]),
]);

export default eslintConfig;
