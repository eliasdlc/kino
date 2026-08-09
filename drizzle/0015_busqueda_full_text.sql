-- KIN-92 · Búsqueda full-text real sobre páginas y tareas.
--
-- Reemplaza el `ILIKE '%término%'` de `search.service.ts` por full-text de Postgres:
-- columna `tsvector` generada, índice GIN encima y ranking por `ts_rank`.
--
-- Por qué GENERATED y no un trigger: la columna se recalcula sola en cada INSERT/UPDATE,
-- es imposible que se desincronice y no hay pieza móvil que mantener. Esto es lo que
-- absorbió al antiguo KIN-93 y lo dejó sin trabajo propio.
--
-- Por qué una configuración propia `spanish_unaccent` en vez de `spanish` a secas:
-- el stemmer español deriva raíces pero NO quita acentos, así que buscar "cancion"
-- no encontraría "canción". Copiar `spanish` y anteponer el diccionario `unaccent`
-- al `spanish_stem` resuelve ambas cosas en la misma pasada. `to_tsvector(regconfig, text)`
-- es IMMUTABLE, que es lo que permite usarlo dentro de una columna generada.
--
-- Por qué se limpia el HTML con regexp_replace: `pages.content` guarda el HTML de Tiptap
-- (`NotebookEditor.tsx:64` persiste `editor.getHTML()`). Indexarlo tal cual metería `div`,
-- `span`, `class` y `data-entity-id` en el índice, y el usuario podría encontrar una página
-- buscando "span". Una columna generada sólo admite funciones inmutables, y `regexp_replace`
-- lo es — por eso se limpia inline en vez de con una función auxiliar o una columna aparte.
-- El texto de las menciones del Codex sí sobrevive: `codex-mention.extension.ts:178` renderiza
-- `@label` como contenido del span, no como atributo.
--
-- `tasks.description` es texto plano (verificado en Neon: 0 de 70 filas con marcado), así
-- que no necesita el paso de limpieza.
--
-- Compatibilidad hacia atrás (dev y prod comparten base): es puramente aditivo. Las columnas
-- son GENERATED, así que ningún INSERT del código ya desplegado tiene que aportarlas, y
-- ningún SELECT existente las pide — a propósito no están en `schema.ts` (ver el comentario
-- en la definición de `pages` y `tasks`).
--
-- Vuelta atrás:
--   DROP INDEX IF EXISTS "idx_tasks_search";
--   DROP INDEX IF EXISTS "idx_pages_search";
--   ALTER TABLE "tasks" DROP COLUMN IF EXISTS "search_vector";
--   ALTER TABLE "pages" DROP COLUMN IF EXISTS "search_vector";
--   DROP TEXT SEARCH CONFIGURATION IF EXISTS public.spanish_unaccent;
-- No hay datos que restaurar: todo es derivado de `title`, `content` y `description`.

CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_ts_config c
		JOIN pg_namespace n ON n.oid = c.cfgnamespace
		WHERE c.cfgname = 'spanish_unaccent' AND n.nspname = 'public'
	) THEN
		CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent ( COPY = pg_catalog.spanish );
		ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
			ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (
	setweight(to_tsvector('public.spanish_unaccent', coalesce("title", '')), 'A') ||
	setweight(to_tsvector('public.spanish_unaccent', regexp_replace(regexp_replace(coalesce("content", ''), '<[^>]*>', ' ', 'g'), '&(nbsp|amp|lt|gt|quot|apos|#39);', ' ', 'g')), 'B')
) STORED;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "search_vector" tsvector GENERATED ALWAYS AS (
	setweight(to_tsvector('public.spanish_unaccent', coalesce("title", '')), 'A') ||
	setweight(to_tsvector('public.spanish_unaccent', coalesce("description", '')), 'B')
) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pages_search" ON "pages" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_search" ON "tasks" USING gin ("search_vector");
