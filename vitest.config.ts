import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src"), "@convex": path.resolve(__dirname, "./convex") };

/**
 * Montar jsdom cuesta unas veinte veces más que correr los tests que lo necesitan,
 * así que sólo lo monta quien toca el DOM. La convención es la extensión: un test
 * de componente es `.test.tsx` y hereda jsdom sin configurar nada.
 *
 * Las excepciones son tests sin componentes que aun así necesitan un DOM: parsean
 * HTML con `DOMParser` o construyen nodos con `document.createElement`.
 */
const domTests = [
  "**/*.test.tsx",
  "src/features/pages/editor-html.test.ts",
  "src/features/pages/mediums/medium-nodes.test.ts",
  "src/features/pages/paste-clean.test.ts",
  "src/features/writing/compile.test.ts",
];

export default defineConfig({
  resolve: { alias },
  test: {
    /**
     * `pnpm test:coverage`. No hay umbral que rompa el CI a propósito: la
     * mitad `.tsx` arranca cerca de cero y un umbral puesto hoy sólo se
     * cumpliría bajándolo. El número está para mirarlo, no para negociarlo.
     */
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**/*.{ts,tsx}", "convex/**/*.ts"],
      exclude: ["**/*.test.{ts,tsx}", "convex/_generated/**", "src/shared/testing/**"],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: [...defaultExclude, ...domTests, "convex/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "convex",
          globals: true,
          // Las funciones de Convex corren en un runtime sin Node; convex-test
          // reproduce ese entorno y necesita ir sin transformar.
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          exclude: defaultExclude,
          server: { deps: { inline: ["convex-test"] } },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          globals: true,
          environment: "jsdom",
          // Lo que jsdom no trae y los componentes llaman al montarse.
          setupFiles: ["./src/shared/testing/jsdom-setup.ts"],
          include: domTests,
          exclude: defaultExclude,
        },
      },
    ],
  },
});
