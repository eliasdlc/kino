import { defineConfig } from "vitest/config";
import path from "path";

/**
 * La batería de integración, aparte de `pnpm test` a propósito: aquélla mockea
 * `@/shared/db` en casi todos sus archivos y ésta es justo la que no puede.
 *
 * La base la levanta `src/shared/db/testing/setup.ts`, una por archivo. Sin
 * `TEST_DATABASE_URL` es PGlite en memoria y los archivos corren en paralelo,
 * porque cada uno tiene la suya. Con `TEST_DATABASE_URL` todos comparten una y
 * se turnan: dentro de un archivo los tests hacen TRUNCATE entre sí, y eso no
 * se puede solapar.
 */
const sharedDatabase = Boolean(process.env.TEST_DATABASE_URL);

export default defineConfig({
  test: {
    name: "integration",
    globals: true,
    environment: "node",
    include: ["**/*.itest.ts"],
    setupFiles: ["./src/shared/db/testing/setup.ts"],
    fileParallelism: !sharedDatabase,
    sequence: { concurrent: false },
    // Levantar PGlite y aplicar 19 migraciones cuesta unos dos segundos antes
    // del primer test; el default de 5s deja poco margen en un CI cargado.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
