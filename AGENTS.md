# Kino: Plataforma de productividad por energía

Plataforma de productividad construida alrededor de la gestión de energía cognitiva y sistemas basados en identidad. Fullstack Next.js 16, 100% serverless.

> **Los planes, el estado y el orden de trabajo viven en Linear**, no en este repo. Este archivo cubre comandos, stack y convenciones de código: nada de roadmap.
>
> En Linear: los proyectos van numerados `01`–`07` en orden de ejecución. Los documentos del equipo *Norte, principios y estándares*, *Estado real del producto* e *Índice de decisiones D1–D16* son la fuente de verdad de qué se construye y por qué.
>
> **En este repo solo se aceptan dos Markdown:** `README.md` y `AGENTS.md`. Ningún plan, audit ni análisis. Un `DESIGN.md` sería el único tercero admisible, y sólo el día que el sistema de diseño necesite su propio documento; hoy no existe. Las notas locales que no son código van a `~/Documents/Kino/dev/`.

## Comandos

```bash
pnpm install                        # Instalar dependencias
pnpm dev                            # Dev server (http://localhost:3000)
pnpm build                          # Build de producción
pnpm lint                           # ESLint strict ( debe pasar con 0 errores
pnpm typecheck                      # tsc --noEmit ) debe pasar
npx convex dev                      # Publica las funciones en el deployment de dev y regenera convex/_generated
npx convex run migrations/<fichero>:run   # Corre una migración de datos contra dev (ver «Migraciones de datos»)
pnpm test                           # Suite completa (lógica pura, sin base)
pnpm check:voz                      # La voz del producto: cinco reglas de grep. Falla en rojo
pnpm check:bundle                   # El JavaScript que se le manda al navegador, contra su tope (exige `pnpm build` antes)
pnpm test -- --run <path>           # Un solo archivo de test
pnpm migrate:convex                 # Importador Postgres → Convex (scripts/migrate-to-convex), sólo para el cutover
```

**Siempre** correr `pnpm typecheck && pnpm lint` después de cualquier cambio. Si alguno falla, se arregla antes de commitear.

## Stack

- **Framework**: Next.js 16 (App Router, API Routes, Server Actions)
- **Lenguaje**: TypeScript strict
- **Base de datos**: Convex (`convex/schema.ts`, treinta y cinco tablas con un test por tabla). El schema de Drizzle sigue en `src/shared/db/schema.ts` sólo como origen del importador
- **Auth**: Clerk. Registro, sesiones, verificación de correo, recuperación de contraseña, proveedores sociales y el panel de cuenta son componentes de Clerk (`@clerk/nextjs`). `src/proxy.ts` monta `clerkMiddleware`; `getServerSession` traduce la identidad de Clerk al usuario de Kino por la fila `accounts` con `providerId = 'clerk'`, y la crea la primera vez. Convex valida el mismo JWT con la plantilla `convex` (`convex/auth.config.ts`)
- **Email transaccional**: ninguno propio. Los correos de cuenta los manda Clerk
- **Server state**: TanStack Query v5
- **Formularios**: react-hook-form + zodResolver
- **Estilos**: Tailwind + shadcn/ui (Radix)
- **Toasts**: sonner · **Gráficas**: Recharts · **Fechas**: date-fns · **Recurrencia**: rrule
- **Editor**: Tiptap v3
- **Background**: Lazy Evaluation (catch-up al entrar) + los crons de Convex (`convex/crons.ts`: snapshot diario y recordatorios cada quince minutos, con bitácora en `cronRuns`)
- **Errores**: Sentry en navegador y API. Inerte sin `NEXT_PUBLIC_SENTRY_DSN`;
  el recorte de datos personales vive en `src/shared/observability/sentry-options.ts`
- **Analítica de producto**: PostHog sin cookies, sólo el funnel de registro.
  Inerte sin `NEXT_PUBLIC_POSTHOG_KEY`; los eventos que existen y las propiedades
  que cada uno puede llevar son una lista cerrada en `src/shared/observability/analytics.ts`
- **Deploy**: Vercel + Convex
- **Package manager**: pnpm (NO npm, NO yarn)

## Restricciones de arquitectura: no violar

1. **$0/mes de infraestructura.** Todo dentro de free tiers de Vercel + Convex.
2. **Sin Redis, sin BullMQ, sin servidor persistente.** 100% serverless.
3. **Sin WebSockets.** Vercel Serverless no soporta conexiones persistentes. Lo que refresca hoy es `refetchOnWindowFocus`, el default de TanStack Query: con un solo usuario, volver a la pestaña llega a tiempo. `refetchInterval` no se usa en ningún sitio y no es la alternativa prescrita: cada intervalo activo es una invocación por usuario y por minuto contra el free tier. La señal que reabriría la decisión es el agente MCP escribiendo mientras miras el tablero.
4. **10s por función, salvo excepción justificada.** El presupuesto está declarado en dos sitios y no es prosa en ninguno de los dos:

   - **En Convex**, `DEFAULT_BUDGET_MS` de `convex/lib/fn.ts`. Una acción nace acotada a 10 s sin que su autor tenga que acordarse; `kinoAction(30_000)` es la única por encima hoy (borrar la cuenta) y lo dice en su comentario.
   - **En Next**, `export const maxDuration`. Lo declaran las tres rutas que hacen trabajo pesado: los dos ZIP de export en 10 s, y `/api/mcp` en 60 s. Esa es **la única excepción viva**, y existe porque el protocolo mantiene la petición abierta mientras el agente encadena herramientas.

   Subir el límite es una decisión, no un ajuste: se escribe en el comentario de la función o la ruta. Y **acotar lo pesado sigue siendo la respuesta primero**: `tasks.list` y `pages.bySystem` devuelven `{ items, restantes }` con un tope duro (`TASK_LIST_LIMIT`, `PAGE_LIST_LIMIT`), y una lectura nueva que pueda crecer sin límite nace igual.
5. **La sesión la emite y la revoca Clerk.** La cookie `__session` es un JWT corto que Clerk renueva cada minuto contra su backend, así que cerrar una sesión desde el panel la corta de verdad en ese plazo. Kino no guarda sesiones propias ni acepta otro token de navegador.

   El conector MCP remoto (`/api/mcp`) entra por el OAuth de Clerk: el cliente se registra en dinámico, el usuario consiente en la pantalla de Clerk y la ruta verifica el access token con `@clerk/mcp-tools`. Convex no puede validar ese token (su `aud` cambia por cliente), así que la ruta firma uno propio de diez minutos con el alcance en `kino_scope` (`convex/lib/mcpToken.ts`, `src/features/mcp/auth.ts`) y Convex lo acepta por el provider `customJwt` de `auth.config.ts`. No hay claves API propias ni tabla `api_keys`.
6. **`system_id` es NOT NULL en tasks.** Toda tarea pertenece a un sistema; Inbox es el default. No hay tareas flotantes.
7. **Timestamps en UTC** (TIMESTAMPTZ). El frontend convierte para mostrar.
8. **Soft delete** en tasks y pages vía `deleted_at`. Siempre filtrar con `WHERE deleted_at IS NULL`.

## Entornos

Producción y desarrollo son **dos deployments de Convex** del mismo proyecto, y cada uno tiene su instancia de Clerk. Ninguna laptop tiene la clave de deploy de producción.

| Entorno | Quién lo usa | Convex | Clerk |
|---|---|---|---|
| Producción | el deploy de `main` en Vercel | deployment `prod`: `CONVEX_DEPLOY_KEY` en la variable **Production** de Vercel, y en ningún otro sitio | instancia Production (`pk_live_` / `sk_live_`) |
| Desarrollo | los previews de Vercel (PRs y `dev`) y el `.env.local` de cada máquina | deployment de dev: `NEXT_PUBLIC_CONVEX_URL` en la variable **Preview** de Vercel y en `.env.local`; las funciones las publica `npx convex dev` desde la laptop | instancia Development (`pk_test_` / `sk_test_`) |

**El schema y las funciones de producción los publica sólo el despliegue.** El `buildCommand` de `vercel.json` es `scripts/vercel-build.sh`: con `CONVEX_DEPLOY_KEY` en el entorno corre `npx convex deploy --cmd 'pnpm build'`, que publica las funciones y deja `NEXT_PUBLIC_CONVEX_URL` puesta para `next build`. Si el schema no valida contra los datos, el build falla y el deploy anterior sigue arriba; el código nunca sale sin sus funciones. Sin la clave (los previews) se construye sólo Next contra el deployment de dev.

Un cambio de schema sigue teniendo que ser **compatible hacia atrás** con el código ya desplegado: Convex valida los documentos existentes contra el schema nuevo antes de aceptarlo, y entre una cosa y la otra el cliente viejo habla con las funciones nuevas.

Cada deployment lleva sus propias variables (`npx convex env set`): `CLERK_JWT_ISSUER_DOMAIN` de su instancia de Clerk, `KINO_MCP_JWKS` con la mitad pública de la clave con la que firma su Vercel, `ENCRYPTION_KEY` para la sincronización con GitHub y el par VAPID para los push. Están descritas en `.env.example`.

Postgres ya no está en el camino de la app. El schema de Drizzle (`src/shared/db/schema.ts`) sigue en el repo como origen de `pnpm migrate:convex`, el importador con el que se movieron los datos; `scripts/migrate-to-convex/verify.mts` compara las dos bases.

**Respaldo.** Convex guarda snapshots propios, pero viven en la misma cuenta que los datos: un borrado de cuenta, una clave comprometida o un `import --replace-all` contra el deployment equivocado se los lleva también. `.github/workflows/backup.yml` exporta producción a un bucket de Cloudflare R2 a las 05:23 UTC: `npx convex export --include-file-storage` cifrado con `age`, en `scripts/backup/dump.sh`. La retención de 30 días es una regla de ciclo de vida del bucket, no lógica del workflow.

Ese volcado ocurre sólo si se cumplen **dos condiciones que no son código**, y por eso este documento no afirma que esté ocurriendo:

1. El workflow existe en `main`. GitHub dispara `schedule:` únicamente desde la rama por defecto, y `workflow_dispatch` tampoco aparece en la interfaz si el fichero no está allí. Tenerlo en `dev` no hace nada.
2. Los seis secretos del repositorio están cargados: `CONVEX_DEPLOY_KEY` (clave de deploy del deployment de **producción**, empieza por `prod:`), `BACKUP_AGE_RECIPIENT` (pública `age1...`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

Cómo se comprueba si está corriendo de verdad, sin creerle a este párrafo:

```bash
gh run list --workflow=backup.yml
```

Sin ejecuciones ahí, el único respaldo de producción son los snapshots de la propia cuenta de Convex. El workflow falla en rojo ante cualquier secreto ausente, vacío o de otro deployment, y sólo se pone verde después de comprobar contra R2 que el objeto existe y mide lo que debe.

La clave privada `age` no está en ningún servicio: vive en el gestor de contraseñas de Elias. Sin ella los volcados son ruido indescifrable, y es el único secreto del sistema que no se puede rotar sin invalidar todo lo guardado hasta ese momento. Si alguna vez el snapshot supera lo que R2 regala (10 GB), es una decisión, no un ajuste.

Las variables de entorno están documentadas en **`.env.example`**, una línea por clave con para qué sirve y si es obligatoria. Toda variable nueva se añade ahí en el mismo commit que la lee.

### Restaurar un respaldo

Los tres scripts de `scripts/backup/` están hechos para leerse en este orden y a las tres de la mañana. `restore.sh` importa con `--replace-all`: **el deployment queda como el snapshot y lo que no venga en él se borra**, no añade. Exige que el nombre del deployment destino se escriba dos veces (dentro de la clave y en `CONFIRM_TARGET`) para que una clave pegada por error no borre nada.

```bash
# 1. Requisitos: age, la CLI de Convex del repo (pnpm install) y la clave privada.
age --version && npx convex --version
export AGE_IDENTITY_FILE=~/.config/kino/backup-age.key   # la del gestor de contraseñas

# 2. Credenciales de R2 y el objeto. La lista sale con el más reciente al final.
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_DEFAULT_REGION=auto
export R2_ENDPOINT="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
aws s3 ls "s3://<R2_BUCKET>/" --endpoint-url "$R2_ENDPOINT" | sort | tail -5
aws s3 cp "s3://<R2_BUCKET>/kino-<fecha>.zip.age" . --endpoint-url "$R2_ENDPOINT"

# 3. Huella del snapshot que se va a restaurar.
scripts/backup/verify.sh kino-<fecha>.zip.age > origen.txt

# 4. El destino: la clave de deploy de ese deployment, y su nombre repetido a mano.
export CONVEX_DEPLOY_KEY='prod:<nombre>|...'
export CONFIRM_TARGET=<nombre>

# 5. Restaurar. Imprime cuánto tardó, que es el tiempo de caída real.
scripts/backup/restore.sh kino-<fecha>.zip.age

# 6. Comprobar que llegó todo. Sin salida en el diff = restauración completa.
npx convex export --include-file-storage --path despues.zip
scripts/backup/verify.sh despues.zip > destino.txt
diff origen.txt destino.txt
```

`verify.sh` sólo lee un snapshot, y cuenta justo lo que un volcado incompleto pierde primero: documentos por tabla, ficheros de `_storage`, cuadernos con texto y sus bytes, entidades con relaciones, y tareas con sistema.

**Para ensayar**, usa el deployment de dev (`dev:` en la clave) o uno de preview: el snapshot pisa lo que haya. **En un desastre real** el origen ya no existe para comparar; la huella del paso 3 sale del propio fichero, así que el `diff` del paso 6 sigue valiendo. Lo que no vuelve con el snapshot son las funciones programadas en vuelo: los crons se registran solos en el siguiente `convex deploy`.

Ensayo sobre el deployment de dev (37 tablas, 550 documentos, 47 cuadernos con 255 106 bytes de contenido, 226 tareas): volcado 2 s y 192 KB cifrados, restauración 12 s, `diff` vacío. Lo que esos números **no** miden es el tamaño real de producción; ese dato sale la primera vez que se restaure allí.

## Estructura: vertical slice

```
src/features/{feature}/
├── {feature}.contract.ts    # Qué entra, qué sale y por qué URL
├── {feature}.router.ts      # Implementación del contrato
├── {feature}.service.ts     # Lógica de negocio (funciones puras donde se pueda)
├── {feature}.schemas.ts     # Schemas Zod + DTOs
├── {feature}.types.ts       # Tipos propios del slice
└── {feature}.queries.ts     # Opcional: ver abajo
```

`.queries.ts` lo tienen 8 de los 27 slices, y es a propósito: se separa cuando el
volumen de queries hace ilegible el servicio, no por norma. En los otros 19 las
queries de Drizzle viven dentro del `.service.ts`, y eso es la forma correcta
ahí. La regla real es que el acceso a datos no sale del slice, no en qué archivo
está.

Cada feature es autocontenida en lo que puede. Tipos, hooks y componentes cruzan entre slices cuando hace falta: `systems` renderiza las tarjetas de `tasks` porque un sistema enseña tareas, y eso no es acoplamiento accidental.

Lo que sí es una decisión: **un `.service.ts` no importa el `.service.ts` de otro slice salvo que orquestar sea su trabajo.** `insights` y `scheduler` orquestan y por eso importan tres servicios cada uno; el resto no debería. Si un servicio necesita lógica de otro y no está orquestando, esa lógica va a `shared` (como `shared/lib/word-count`, que usaban `pages` y `writing` a la vez y creaba un ciclo entre los dos slices).

No hay `index.ts` por slice ni regla de lint que lo verifique, y es a propósito: con veintisiete slices y un desarrollador, declarar una superficie pública por slice cuesta más de lo que evita.

## Convenciones de código

### Data fetching

Toda lectura de servidor pasa por TanStack Query. Cero `fetch` suelto en componentes, cero `useEffect + setState` para datos de servidor.

Los query keys se declaran como **factory por feature** (`taskKeys`, `pageKeys`, …), nunca como strings inline. No hay factory central: cada slice expone el suyo.

### Mutaciones: patrón optimista canónico

**Todas** las mutaciones lo usan, sin excepción: UI optimista siempre, rollback en error, invalidate en settled. El patrón no se escribe a mano: vive en `src/shared/hooks/optimistic.ts`, en tres formas según sobre qué se aplique.

| Hook | Para qué |
|---|---|
| `useOptimisticList` | Una lista bajo una key. Completar, borrar, editar o mover dentro de ella |
| `useOptimisticRecord` | Un registro bajo una key. Ajustes, la rejilla de escenas, la cronología |
| `useOptimisticScope` | Todas las listas de un prefijo. Una tarea se ve a la vez en el plan de hoy, en la lista global y en la de su sistema |

La invalidación es parte del hook, no una decisión por mutación: ahí estaba el riesgo real, con uno invalidando un prefijo y otro una clave exacta, y la diferencia notándose sólo con dos vistas abiertas.

Lo que no cabe (leer de una cache y escribir en otra, o una creación encolable sin conexión) se escribe inline **con un comentario diciendo por qué**. Son cinco casos y los cinco lo llevan.

### Fechas y timezone

**El gotcha número uno del proyecto.** Todo gira alrededor de "hoy", `dueDate`, slots y "vencidas".

- Todo pasa por **`src/shared/time`** (`userToday`, `userDayRange`, `sqlUserDay`, `dayToLocalISO`, `zonedDayHourToUtc`). **Está prohibido reimplementar "hoy en la timezone del usuario"** en cualquier otro lado.
- `dueDate` y `startDate` son **`timestamptz` con hora opcional**, no columnas DATE. Cuidado con el off-by-one.
- El cálculo de "hoy" y de slots para lógica de negocio se hace **en el servidor** con la timezone del usuario. El cliente solo pinta: así un reloj mal puesto en el cliente no corrompe el plan.

### El contrato de la API

Un slice migrado declara su API en `{feature}.contract.ts`: método, URL, schema de
entrada y **schema de salida**. De ahí salen las dos puntas: `{feature}.router.ts`
la implementa y `@/shared/api/client` la consume tipada. Cambiar la salida de un
endpoint rompe el `typecheck` en el hook que la lee, que es justo lo que antes no
pasaba porque el cliente afirmaba la respuesta con un cast.

- **Un contrato por slice, al lado de sus schemas.** Lo único central es la
  composición: `shared/api/contract.router.ts` (lo que importa el cliente) y
  `shared/api/router.ts` (lo que sirve el servidor).
- **Los schemas de entrada no se reescriben:** son los mismos de
  `{feature}.schemas.ts`. Las rutas con params llevan el param dentro del schema
  y oRPC lo saca de la URL.
- **La salida se declara con `type<Fila, Transport<Fila>>(toTransport)`.** El tipo
  del cliente se deriva de la tabla, y como la fila y su forma de transporte no
  son el mismo tipo, el compilador exige la conversión.
- **Los permisos salen del contrato:** el scope se deriva del método y `meta` es
  la excepción (`{ scope }` para los POST que sólo leen, `{ sessionOnly: true }`
  para lo que toca credenciales).
- **Añadir un endpoint no toca `app/`.** `src/app/api/[...rest]/route.ts` es un
  catch-all y sirve toda la API. Los pocos `route.ts` que quedan son los que no
  caben en el contrato (`/api/mcp`, los dos 302 de GitHub, los dos
  ZIP de export y las dos de `uploads`) y cada uno tiene
  su razón escrita en ese archivo. `route()` sobrevive sólo como la escotilla de
  esos casos.
- **Los códigos de error no cambian:** 401 `UNAUTHORIZED`, 403 `INSUFFICIENT_SCOPE`
  / `SESSION_REQUIRED`, 404 `NOT_FOUND`, 400 `VALIDATION_ERROR` de schema, 422
  `VALIDATION_ERROR` de regla de dominio, 409 `CONFLICT` cuando el recurso está
  bien y quien falla es el momento (una versión vieja, un enlace repetido), 500
  `INTERNAL_ERROR`. La traducción vive en `shared/api/handler.ts` y en
  `shared/api/procedures.ts`.

**Las tools del MCP son funciones de Convex con nombre.** Viven en `src/features/mcp/tools/catalog.ts`: cada `readTool`/`writeTool` apunta a una función de `api.*` y el compilador exige que la entrada del schema encaje en sus argumentos (o que la tool declare `args` para adaptarla), así que cambiar una función deja de compilar la tool que la usa. Lo escrito a mano es lo que el agente lee: el nombre y la descripción. `catalog.test.ts` fija la lista de nombres como contrato visible: quitar o añadir una tool pasa por ahí. Las sesiones de aprendizaje (`learning.ts`) son secuencias sobre varias funciones y van aparte.

Lo que cruza la red no es una fila: `Transport<T>` (en `shared/api/transport.ts`)
convierte las fechas en texto ISO, que es lo que sobrevive a un `JSON.stringify`.
El cliente usa `TaskTransport`, no `Task`, y un Server Component que pase filas
como `initialData` tiene que llamar a `toTransport` primero.

### Rutas fuera de Convex

Una ruta de Next **no hereda el modelo de alcances**. El envoltorio de `convex/lib/fn.ts` es quien resuelve la identidad y comprueba `kino_scope`, y una ruta que no llama a Convex por él no pasa por ninguna de las dos cosas.

Así que **toda ruta fuera de Convex comprueba a mano quién llama, o escribe en su comentario por qué no hace falta**. Hoy son seis y cada una lo dice:

| Ruta | Qué exige |
|---|---|
| `/api/export/workspace`, `/api/systems/[id]/export` | sesión de navegador (`getServerSession`). Un token del conector MCP trae `userId` y nunca `sessionId`: ahí se corta, y `export.test.ts` lo prueba |
| `/api/mcp` | el access token de Clerk, verificado con `@clerk/mcp-tools`; de ahí sale el `kino_scope` que Convex recibe |
| `/api/uploads` | sesión de navegador |
| `/api/integrations/github/{connect,callback}` | sesión de navegador, más el `state` del OAuth |

Comprobar la sesión **no** es lo mismo que comprobar el alcance. Una ruta que quiera dejar entrar a un agente tiene que mirar su alcance ella misma.

### Validación

Una sola fuente Zod por entidad, importada por servidor y cliente. El backend **siempre** valida aunque el cliente ya lo hizo. `userId` **siempre** viene de la sesión, nunca del body. Los `metadata` jsonb se validan con Zod discriminado por `systemType`: metadata no es un saco.

**Todo campo de texto libre lleva `.max()` con su cifra y su motivo escritos al lado.** Sin tope, un solo `create` agota el plan gratuito. Los tres que lo necesitaban están en `PAGE_CONTENT_MAX` (500.000), `TASK_DESCRIPTION_MAX` (10.000) y `TEXT_ANCHOR_MAX` (2.000). El tope es **de escritura**: lo que ya está guardado por encima se lee igual, porque un tope nuevo no puede dejar a nadie sin su texto.

### El alcance de cada función

Cuánto llega un agente a hacer no lo decide su token, lo decide la función. Son cuatro, y se declaran eligiendo el constructor de `convex/lib/fn.ts`:

| Alcance | Constructor | Qué es |
|---|---|---|
| `readOnly` | `kinoQuery`, `kinoZodQuery` | leer. Cualquier conector llega |
| `direct` | `kinoMutation`, `kinoZodMutation`, `kinoAction()` | escribir algo reversible |
| `proposed` | `kinoProposal`, `kinoZodProposal` | proponer, no escribir |
| `closed` | `kinoClosed`, `kinoZodClosed`, `kinoAction(ms, 'closed')` | sólo desde el navegador. Ningún alcance del conector lo abre |

Es el principio de la casa escrito donde se aplica: se escribe lo reversible, se propone lo que suplanta tu voz, y lo irreversible o lo que toca credenciales no se toca desde fuera. `closed` exige sesión, no alcance: un token del conector trae `userId` y nunca `sessionId`.

`convex/reach.test.ts` recorre las funciones públicas, falla si alguna no declara alcance, imprime la cuenta y comprueba que el catálogo del MCP no publica ninguna cerrada. El tipo generado de `api.*` no conserva esa marca, así que **ese test es la comprobación, no el compilador**: quitarlo deja la regla sin nadie que la sostenga.

### Estado

| Tipo | Herramienta |
|---|---|
| Server state | TanStack Query |
| Filtros de lista | URL (`useSearchParams`) |
| UI efímera | `useState` / `useReducer` |
| Timer activo cross-route | React Context en root |
| UI global (abierto/cerrado, tema, sidebar) | Zustand |

**Zustand sólo para estado de UI global.** Nunca datos de servidor: eso es de TanStack Query y no se copia a un store paralelo. La regla existía para impedir esa fuga, y esa fuga no se ha dado: los cuatro stores que hay (`ThemeProvider`, `command-palette`, `quick-add`, `systems`) guardan booleanos y preferencias. Para un booleano de apertura, un provider más en el árbol re-renderiza todo lo que cuelga de él a cambio de nada.

**No introducir Redux ni Jotai.** Con TanStack Query, Zustand y el Context que ya existe para el timer, sobra.

### Lógica de negocio

Todo scoring de energía, urgencia e importancia vive en el **backend** (`*.service.ts`). El cliente nunca recalcula: recibe el valor ya computado.

### Animaciones

CSS puro: keyframes, transitions, Tailwind. **No instalar Framer Motion.**

- Animar `transform`, `opacity` y color. Nunca una propiedad de layout (`width`, `height`, `top`, `left`), y nunca un desenfoque en bucle: clava la GPU en pantallas de refresco alto.
- **`prefers-reduced-motion` lo apaga todo desde `globals.css`**, en un bloque sobre `*`. Es global a propósito: `motion-safe:` sólo alcanza las clases de Tailwind, y seis animaciones de la landing se declaran dentro de un `style` inline, donde por construcción no llega.
- Una animación que corre en JavaScript (una cuenta, un desplazamiento suave) no la apaga ese bloque: tiene que preguntar por la preferencia ella misma, como hace `EnergyTodayCard`.
- `transition-all` ya no está en ninguna de las primitivas de `components/ui`: cada una declara las propiedades que de verdad transiciona. Quedan 34 en código de feature, y cada pasada de UI convierte las suyas; no se añaden nuevas.

### UI

- **Sin emojis.** Texto o iconos lucide.
- **Mobile**: `ResponsiveDialog` (Dialog en desktop, Drawer en móvil), vistas `*MobileView`, **sin drag and drop en touch**, acciones hover con `md:opacity-0`.
- Todo cambio de UI se previsualiza en **`/system-design`** y añade su specimen.
- Cada ruta con su `loading.tsx`, cubierta por un `error.tsx`.
- **Verificar mirando**: `node scripts/capturas/run.mjs` (con `pnpm dev` corriendo) captura las 19 rutas con la cuenta sembrada a 393x852, 430x748, 1131x686 y 1440x900, en claro y oscuro; `scripts/capturas/sembrar.mjs` le da densidad a esa cuenta en el deployment de dev. Nada visible se da por hecho sin esas capturas.

### Tests

Una sola batería, `pnpm test`, en tres proyectos de Vitest según el entorno que necesitan (`vitest.config.ts`):

- **`src/**/*.test.ts`** → lógica pura en Node. Sin base, sin red.
- **`convex/**/*.test.ts`** → las funciones de Convex contra `convex-test`, en el proceso y con el schema real: aislamiento entre usuarios, máquinas de estado, crons. Es la batería que antes pedía Postgres y ya no pide nada.
- **`*.test.tsx`** y los pocos `.test.ts` listados en `domTests` → jsdom, sólo para lo que toca el DOM.

Un test de función vale lo que vale su versión rota: si se invierte la condición y la batería sigue verde, el test no estaba probando la función.

**Todo `.test.tsx` renderiza desde `@/shared/testing/render`** (`renderWithProviders`, `renderMobile`, `makeTestConvexClient`). Uno que monte su propio árbol de proveedores se rechaza en revisión: cinco copias del árbol se quedan viejas de una en una sin que nada falle. Los polyfills que jsdom no trae viven en `src/shared/testing/jsdom-setup.ts`, cada uno con el componente que lo llama escrito al lado, y `next/navigation` se finge desde `@/shared/testing/navigation`, nunca a mano.

Un `.test.tsx` abre con un comentario de tres a cinco líneas que dice **qué criterio** prueba. Si ese comentario no se puede escribir, el test no vale: un test de humo por pasada convierte la regla en un trámite. Y las aserciones son de `jest-dom` (`toBeVisible`, `toBeDisabled`, `toBeInTheDocument`), nunca `toBeDefined()`, que pasa aunque el elemento esté oculto.

`pnpm test:coverage` imprime el número. No hay umbral que rompa el CI: la mitad `.tsx` arranca cerca de cero y un umbral puesto hoy sólo se cumpliría bajándolo.

### El manifiesto de arquetipo

`src/shared/lib/system-types.ts` es la fuente única de cómo se comporta cada `systemType`: vocabulario, `folderRole`, `pageRole`, `taskKinds`. **Nunca hardcodear un label o un comportamiento por tipo de sistema**: se lee del manifiesto. Añadir un arquetipo debe ser añadir una entrada, no un fork de código.

Lo mismo para los mediums de escritura en `src/shared/lib/mediums.ts`. Ojo: el manifiesto gobierna lo que el editor **ofrece** (slash menu, plantilla, export), no lo que el schema admite: los nodos se montan siempre para que cambiar de medium nunca degrade contenido ya escrito.

## Git

- **Ramas**: `main` → `dev` → rama de feature. Nunca push directo a `main`.
- **Commits**: Conventional Commits, atómicos, **sin trailers de atribución a IA**.
- Las ramas completadas son registro histórico: **no se borran**.
- Antes de un PR: `pnpm typecheck && pnpm lint && pnpm test`.
- Nunca commitear `.env` ni secretos. `.env.example` es el único `.env` versionado y no lleva valores reales.

## Definition of Done

Criterio de aceptación cumplido · `typecheck` limpio · `lint` en 0 · tests verdes con test nuevo si se tocó lógica · commit atómico · decisión no trivial anotada en el issue de Linear.

## Qué NO hacer

- **No** guardar timestamps sin timezone.
- **No** importar el `.service.ts` de otro slice sin estar orquestando.
- **No** usar `any`.
- **No** saltarse Zod en ningún input de endpoint.
- **No** introducir Redux ni Jotai, ni meter datos de servidor en un store de Zustand.
- **No** implementar guards de Premium/subscripción: no existe código de payments.
- **No** reimplementar cálculos de fecha fuera de `src/shared/time`.
- **No** crear archivos Markdown en el repo más allá de `README.md` y `AGENTS.md`.

## Migraciones de datos

Convex valida el schema contra los documentos que ya existen: si un campo pasa
a obligatorio y hay una sola fila sin él, el deploy se rechaza y el anterior
sigue arriba. De ahí la única regla que gobierna esta parte, **expand y
contract**: un campo nace opcional, una migración lo rellena en todos los
documentos, todo escritor lo escribe, y sólo entonces, **en otro deploy**,
deja de ser opcional. Nunca las dos cosas a la vez.

Las migraciones viven en `convex/migrations/`, una por fichero, sobre el
componente oficial `@convex-dev/migrations` que registra `convex/convex.config.ts`.
El componente guarda el estado de cada una (lote, cursor, si terminó), así que
una que muere a mitad retoma donde iba y una segunda pasada no repite trabajo.
Además cada paso comprueba antes de escribir: reejecutar una migración
completa no toca ningún documento.

La cabecera de cada fichero enumera campo por campo qué rellena y de dónde sale
cada valor. Es lo que hay que leer antes de correrla, y lo que hay que
actualizar si cambia.

```bash
npx convex run migrations/autoriaYPapelera:run        # todas las de un fichero, en orden
npx convex run migrations/autoriaYPapelera:tasksAutoria   # una suelta
```

Contra producción **nunca a mano**: el `convex deploy` del build las publica, y
correrlas es una decisión aparte que se toma con el respaldo del día delante.

### Retenciones

Cada tabla que caduca dice aquí quién la poda. Una tabla nueva sin esta línea
está incompleta.

| Tabla | Retención | Quién la dispara |
|---|---|---|
| `eventLog` | 30 días desde `occurredAt` | cron `event-log-prune`, por lotes de 1.000 que se reprograman solos (`convex/eventLog.ts`) |
| `itemLinks` | 30 días desde `lastSeenAt` | el mismo cron, cuando exista quien las escriba |
| `proposals` | 14 días desde `expiresAt` | nadie: pasan a `expired` al mirarlas, no se borran |
| `captures` | 48 h sin confirmar | caducan con aviso; el blob se va con la fila |
| `systemMembers`, `systemInvites`, `sessionDigests` | no se podan | son estado y rastro, no historia |
| `cronRuns` | ver `convex/cronRuns.ts` | el snapshot diario |

### Borrados y cascadas

Convex no tiene `ON DELETE`: cada cascada es un paso explícito dentro de la
mutación que borra, o no ocurre. La lista completa de las que heredamos de
Postgres está en `scripts/migrate-to-convex/cascadas.ts`, y un test la mantiene
igual a lo que declaraba el schema de Drizzle.

Casi todos los borrados de Kino son **blandos** (`deletedAt`), y eso decide la
forma de la cascada: **una cascada blanda no destruye lo que cuelga**. Marca a
los hijos que también tienen `deletedAt` (subtareas, subcapítulos, subcarpetas,
notas) y deja intacto lo que sólo se alcanza a través del padre (recordatorios,
tiempo, versiones, enlaces), porque restaurar tiene que devolver la cosa
entera y sus lectores ya filtran por el padre borrado.

Las excepciones, y por qué:

- **Derivadas** (`pageEntityMentions`): se borran de verdad; se recalculan al
  guardar el texto.
- **Etiquetas** (`tags.remove`): destruye de verdad. Sólo el dueño del sistema,
  desetiqueta únicamente dentro de su alcance, y deja fila en `eventLog`.
- **Sistemas** (`systems.remove`): no borra, archiva (`isActive: false`). Sus
  siete cascadas de Postgres no ocurren a propósito.
- **Cuenta** (`users.purge`): el único borrado duro de todo, sobre las
  dieciocho tablas con `userId`.

## Features en el schema sin implementación activa

No referenciarlas como si existieran:

- **Billing / Premium**: `subscriptionStatus` y `planType` son placeholders, sin código.
- **Sync adapters**: `syncConnections` sólo la usa GitHub (ver abajo). El resto de valores de `syncProviderEnum` siguen sin lógica.
- **iCalendar import**: sin implementación.
- **Context tags**: tabla en schema, sin pantalla de gestión.
- **Captura offline**: existe `/offline` y un service worker que **solo** hace push. No hay cola de mutaciones.

## Sincronización con GitHub (KIN-135)

Un sistema `project` puede declarar un repositorio en `systems.metadata.github` y traer sus issues al board como tarjetas. El slice es `src/features/github-sync/`.

- **Dirección: sólo lectura.** GitHub manda sobre título, cuerpo, abierto/cerrado y milestone. Kino nunca escribe en GitHub.
- **Idempotencia** por `uq_tasks_external` `(user_id, external_source, external_id)`, con `external_id` = id numérico global del issue. Los milestones mapean a sprints por `uq_sprints_external` `(system_id, external_id)`.
- **Lo que un refresco nunca pisa**: `energyLevel`, `dueDate`, `startDate`, `inTodayPlan` y demás campos de `KINO_OWNED_FIELDS` (`github-sync.mapper.ts`). Son el valor que Kino añade sobre un issue; si un refresco los borrara, el feature destruiría trabajo.
- **Columnas**: issue cerrado → columna terminal (que completa la tarea por el puente de `moveTaskBoard`); reabierto → sale de la terminal. Las columnas intermedias las mueve la persona y la sincronización no las toca.
- **Refresco**: bajo demanda al abrir el board o con el botón. Sin cron: un repo que nadie mira no gasta nada.

Necesita `GITHUB_SYNC_CLIENT_ID`, `GITHUB_SYNC_CLIENT_SECRET` y `ENCRYPTION_KEY` (ver `.env.example`). Son un OAuth App aparte del login porque GitHub sólo admite **una** URL de callback por app y esa ya la ocupa Clerk, y porque leer issues privados exige el scope `repo`. Sin estas variables la integración se oculta sola: no rompe nada, simplemente no aparece.
