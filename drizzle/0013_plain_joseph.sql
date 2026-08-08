-- DB-06 (KIN-151) · Podar tipos enum sin ninguna columna.
--
-- `task_status` y `frequency` son tipos fantasma: cero columnas los referencian.
--   · task_status  — `tasks.status` es varchar(50) con el CHECK `tasks_status_valid`,
--                    nunca fue este enum. Además arrastraba `archived`, valor que
--                    salió del eje de status en D3.
--   · frequency    — resto de la recurrencia. Su única columna era `quests.frequency`,
--                    y la tabla `quests` se borró en 0001_grey_roulette.sql. La
--                    recurrencia terminó viviendo en `recurrence_rule varchar(500)`.
--
-- Verificado contra Neon (dev y prod comparten base) vía pg_attribute + pg_depend:
-- ninguna columna, default, dominio ni función depende de estos dos tipos.
--
-- Vuelta atrás — Postgres no deshace un DROP TYPE, se recrea a mano:
--   CREATE TYPE "public"."frequency"   AS ENUM('daily', 'weekly', 'monthly');
--   CREATE TYPE "public"."task_status" AS ENUM('backlog', 'week', 'tomorrow', 'today', 'done', 'archived');
-- No hay datos que restaurar: al no existir columnas, no hay filas que dependan de ellos.

DROP TYPE IF EXISTS "public"."frequency";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."task_status";
