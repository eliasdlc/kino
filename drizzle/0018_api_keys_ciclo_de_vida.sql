-- Caducidad y revocación de API keys, más dos restos del schema.
--
-- Compatible hacia atrás, que es obligatorio porque desarrollo y producción
-- comparten base:
--   · Las dos columnas son nullable. null significa "no caduca" y "activa",
--     que es exactamente lo que son las claves ya emitidas: la migración no
--     caduca ninguna retroactivamente.
--   · `idx_api_keys_hash` era un duplicado del índice que ya crea el UNIQUE de
--     `key_hash`. Las búsquedas por hash siguen usando el que queda.
--   · `default_context_tags` no la referenciaba ningún servicio, query ni ruta,
--     y estaba vacía en la base compartida (verificado antes de generar esto).
--     Sin CASCADE a propósito: si algo dependiera de ella, esto debe fallar.
DROP TABLE "default_context_tags";--> statement-breakpoint
DROP INDEX "idx_api_keys_hash";--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" timestamp with time zone;
