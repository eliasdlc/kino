import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Las reglas de AGENTS.md que un linter puede vigilar. Cada mensaje dice
    // el arreglo, porque el agente copia el código y no la nota.
    files: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: ["redux", "@reduxjs/toolkit", "react-redux", "jotai"].map((name) => ({
            name,
            message:
              "Sin Redux ni Jotai. UI efímera en useState/useReducer, filtros en la URL, UI global en un store de Zustand; los datos del servidor viven en useConvexQuery.",
          })),
          patterns: [
            {
              group: ["redux/*", "@reduxjs/toolkit/*", "react-redux/*", "jotai/*"],
              message: "Sin Redux ni Jotai. Usa useState/useReducer, la URL o Zustand para UI global.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='refetchInterval']",
          message:
            "Ninguna pantalla refresca datos por tiempo. Convex es reactivo: lee con useConvexQuery y la suscripción se actualiza sola.",
        },
      ],
    },
  },
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
    // Lo escribe `npx convex dev` en cada cambio del schema o de una función.
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
