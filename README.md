# Kino

La app de planificación que entiende tu energía.

No es otra lista de tareas ni un Notion genérico: Kino aprende tu curva de energía real a partir de tus check-ins y tu actividad, y organiza tu día —o tu semestre, o tu novela— alrededor de ella. Un agente puede operarla por ti vía MCP.

## Qué la hace distinta

**El motor de energía.** Kino modela tu cronotipo, aprende una curva personalizada con calibración por franja horaria, calcula fatiga ultradiana y usa todo eso para sugerir qué hacer y cuándo. Predice tu nivel **antes** de que hagas el check-in y guarda esa predicción, de modo que cuando dice "acerté" no es circular.

**Los arquetipos.** Un sistema de tipo académico habla de clases y entregas; uno de escritura, de obras y capítulos; uno de proyecto, de sprints y epics. No son plantillas cosméticas: un manifiesto único parametriza el vocabulario, la estructura y las clases de tarea de cada arquetipo.

**Agent-native.** ~65 herramientas MCP exponen tareas, sistemas, páginas, el codex narrativo y el propio motor de energía. Un agente puede leer tu curva, proponerte bloques para el día y escribirlos en tu calendario.

## Stack

Next.js 16 · TypeScript · Drizzle + PostgreSQL (Neon) · Better Auth · TanStack Query · Tailwind + shadcn/ui · Tiptap · Vercel

100% serverless, dentro de free tiers.

## Desarrollo

Hace falta Node, pnpm y un Postgres con las extensiones `uuid-ossp` y `ltree`: la rama de desarrollo de Neon, o el de `docker-compose.yml` (`docker compose up -d`), que las crea solo. Nunca la base de producción: su cadena sólo existe en Vercel.

```bash
pnpm install
cp .env.example .env.local   # cada variable dice para qué sirve y si es obligatoria
pnpm db:migrate              # aplica las migraciones a la base de .env.local
pnpm dev                     # http://localhost:3000
pnpm test
pnpm typecheck && pnpm lint
```

Con `DATABASE_URL` la app arranca. El resto de variables encienden funciones (login social, push, imágenes, correo, sincronización con GitHub) y sin ellas esa función se apaga sin romper nada; [`.env.example`](./.env.example) explica cada una.

Las convenciones de código, restricciones de arquitectura y el flujo de trabajo están en [`AGENTS.md`](./AGENTS.md).

La planificación —qué se está construyendo, en qué orden y por qué— vive en Linear, no en este repositorio.
