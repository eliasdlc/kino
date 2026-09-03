import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

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
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: [...defaultExclude, ...domTests],
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
