// drizzle.config.ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next.js, así que carga el .env manualmente.
// .env.local tiene prioridad (mismos secretos que usa la app); .env es respaldo.
// dotenv no pisa lo ya exportado: en Vercel no hay archivos y DATABASE_URL llega
// del entorno que se está construyendo (Production o Preview), y en local
// `DATABASE_URL=... pnpm db:migrate` apunta donde se diga.
config({ path: [".env.local", ".env"] });

export default defineConfig({
    schema: "./src/shared/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
