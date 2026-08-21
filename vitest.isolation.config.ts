import { defineConfig } from "vitest/config";
import path from "path";

/**
 * La batería de aislamiento (KIN-190), aparte de `pnpm test` a propósito.
 *
 * Corre contra un Postgres real y por eso no puede vivir en la suite normal,
 * que no necesita base y tarda veinte segundos. Aquí no hay skip silencioso:
 * sin `DATABASE_URL` el arranque falla, porque un test de autorización que se
 * salta a sí mismo es peor que no tenerlo.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "La batería de aislamiento necesita DATABASE_URL apuntando a una base de pruebas. " +
      "Nunca a la de producción: cada test hace TRUNCATE de users en cascada.",
  );
}

export default defineConfig({
  test: {
    name: "isolation",
    globals: true,
    environment: "node",
    include: ["**/*.itest.ts"],
    // Los tests comparten una sola base y hacen TRUNCATE entre cada uno, así
    // que no pueden solaparse.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
