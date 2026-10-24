import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src"), "@convex": path.resolve(__dirname, "./convex") };

/**
 * Montar jsdom cuesta unas veinte veces más que correr los tests que lo necesitan,
 * así que sólo lo monta quien toca el DOM. La convención es la extensión: un test
 * de componente es `.test.tsx` y hereda jsdom sin configurar nada.
 *
 * Las excepciones son tests sin componentes que aun así necesitan un DOM: parsean
 * HTML con `DOMParser`, construyen nodos con `document.createElement` o preguntan
 * por una preferencia del sistema con `window.matchMedia`.
 */
const domTests = [
  "**/*.test.tsx",
  "src/shared/utils/motion.test.ts",
  "src/features/pages/editor-html.test.ts",
  "src/features/pages/mediums/medium-nodes.test.ts",
  "src/features/pages/paste-clean.test.ts",
  "src/features/sticky-notes/anchor-utils.test.ts",
  "src/features/sticky-notes/anchor-paint.test.ts",
  "src/features/sticky-notes/drop-note.test.ts",
  "src/features/reviews/review-highlight.test.ts",
  "src/features/writing/compile.test.ts",
];

/**
 * El tope por test, medido el 15 de octubre de 2026 con el reporter JSON. El
 * test más lento que vive bajo este tope tardó 9,7 s en la laptop de 16 núcleos
 * con la carga a 37,8 (dos agentes y dos `next build` a la vez), y 3,8 s en una
 * máquina de 4 núcleos como el runner de CI. Treinta segundos son tres veces el
 * peor caso medido: un rojo por tiempo ya no sale de una máquina cargada, sale
 * de un test que se colgó. El default de vitest eran 5 s, y siete tests lo
 * pasaban en esa corrida cargada sin estar rotos.
 *
 * Va dentro de cada proyecto: los proyectos en línea no heredan las opciones
 * `test` de la raíz, así que un tope puesto sólo arriba no llega a ningún test.
 * Los que necesitan más lo declaran ellos mismos, con su motivo al lado (las
 * podas de `eventLog.test.ts` llegan a 300 s).
 */
const testTimeout = 30_000;

export default defineConfig({
  resolve: { alias },
  test: {
    /**
     * Fuera de CI la suite usa la mitad de los núcleos. Con todos, satura la
     * laptop ella sola y alarga la cola: en la misma carga, el test más lento
     * bajó de 9,7 s a 5,9 s y la corrida entera tardó 97 s en vez de 87 s. En
     * CI el runner tiene cuatro núcleos y nadie más corriendo, así que se queda
     * con el reparto por defecto.
     */
    maxWorkers: process.env.CI ? undefined : "50%",
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
          testTimeout,
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
          testTimeout,
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
          testTimeout,
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
