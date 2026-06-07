// drizzle.config.ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next.js, así que carga el .env manualmente.
// .env.local tiene prioridad (mismos secretos que usa la app); .env es respaldo.
config({ path: [".env.local", ".env"] });

export default defineConfig({
    schema: "./src/shared/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});