# PLAN-10 — Sticky Notes v2: anclaje a texto + drag físico libre

> Prioridad: alta (sesión dedicada a pulir sticky notes)
> Rama: `dev` (rama de trabajo actual)
> Depende de: ninguno (autónomo dentro de `src/features/sticky-notes` + levantar el editor Tiptap en `PageEditor`/`NotebookEditorLayout`)
> Estado: **propuesto, pendiente de ejecutar** — Fase A es el siguiente paso (incluye migración)
> Versión: 2026-06-16

---

## 0. Para quien retome esto en otro chat

Este documento es el contexto completo de una conversación de diseño sobre las
sticky notes de Kino. Resume **qué está mal hoy**, **qué decisiones se tomaron**,
el **modelo de datos final** y el **plan de ejecución por fases**. Léelo entero
antes de tocar código. El plan se ejecuta **fase por fase, verificando cada una**.

La feature original está descrita en `docs/plans/PLAN-05-sticky-notes.md`; este
documento la evoluciona (v2).

---

## 1. Contexto: qué son las sticky notes hoy

Notas tipo post-it que viven en dos sitios:

- **Grid inline** (`StickyNotesGrid.tsx`): cuadrícula arriba del editor. Usa
  dnd-kit para apilar notas (`stackId`). Muestra solo las notas **sin**
  `positionSide`.
- **Margen flotante** (`MarginNotesLayer.tsx`): capa `absolute inset-0` sobre el
  área del editor; las notas con `positionSide` (`left`/`right`) flotan en los
  márgenes laterales de la columna de texto. Usa dnd-kit para arrastrar.

El editor de la página (`PageEditor.tsx`) es **Tiptap / ProseMirror**, guarda el
contenido como HTML plano. Al crear una nota desde una selección de texto, se
copia el texto seleccionado a `textAnchor` (solo un string snapshot; **no** deja
ninguna marca en el documento).

Archivos de la feature (`src/features/sticky-notes/`):
`StickyNoteCard.tsx`, `StickyNotesGrid.tsx`, `StickyNoteStack.tsx`,
`StickyNoteCreator.tsx`, `MarginNotesLayer.tsx`, `sticky-note-colors.ts`,
`sticky-notes.hooks.ts`, `sticky-notes.service.ts`, `sticky-notes.schemas.ts`,
`sticky-notes.types.ts`, `sticky-notes.routes.ts`.
Montaje: `src/features/pages/NotebookEditorLayout.tsx` (renderiza grid + margen,
pasa `contentRef`).
Schema DB: `src/shared/db/schema.ts` (tabla `stickyNotes`, ~línea 870).

---

## 2. Diagnóstico: problemas reportados y causa raíz

Reportados por el usuario sobre las notas de **margen**:

1. **Solo se mueve en Y / "salta" de vuelta.** Las notas de margen guardan solo
   `positionSide` (`left`/`right`) + `positionY` (% entero). La X está clavada al
   borde (`left/right: 0.75rem`). Al soltar, dnd-kit resetea el `transform` a 0 y,
   como la X nunca se persiste, el `transition: transform 160ms` la **anima de
   vuelta** al margen. De ahí el salto.
2. **No cambia en vivo / no se siente real.** dnd-kit está pensado para
   *sortable/droppable*, no para posicionamiento libre 2D. Es la abstracción
   equivocada para arrastrar un post-it libre.
3. **Tapa el texto en pantallas medianas.** La capa es `absolute inset-0` sobre
   todo el ancho; la columna de texto es `max-w-3xl` centrada. Cuando el margen
   lateral se estrecha (breakpoint md, o con ambas sidebars abiertas), la nota
   `w-44` (176px) se monta sobre el texto. Nada impide soltarla encima.
4. **Rotación excesiva.** El margen usa `±4..9°` (`tiltFor`). Demasiado.
5. **Corta el texto.** `StickyNoteCard` es `aspect-square overflow-hidden` con
   `line-clamp`. Cuadrado fijo + recorte = texto cortado, sin wrap completo.
6. **Crece demasiado según el tamaño de pantalla.** En el grid la card es
   `aspect-square w-full`, escala con el ancho de columna sin tope.

### Agujeros adicionales detectados (no reportados, pero necesarios)

- **Precisión:** `positionY` es **entero %**. En una página larga, 1% = 30–50px,
  así que la nota "salta" a la cuadrícula del 1% en vez de quedar exacta. Para que
  "se quede donde la sueltas" hay que guardar X/Y con **decimales**.
- **Sin clamp en X / bordes:** solo se acota Y (0–92). Con arrastre libre se puede
  mandar una nota fuera de pantalla y perderla.
- **Sin orden de apilado:** con X libre dos notas se solapan; el `zIndex` es
  estático (vuelve a 30 al soltar), así que una nota soltada encima puede quedar
  **detrás** y no se puede agarrar. Falta traer-al-frente al tocar.
- **Polling vs arrastre:** `refetchInterval: 5000` recarga del server cada 5s; si
  cae a mitad de arrastre o al soltar, pisa el update optimista → "tirón". Hay que
  pausarlo mientras se arrastra.
- **Móvil = pérdida de datos visible:** la capa es `hidden md:block` **y** el grid
  filtra las que tienen `positionSide`. Una nota fijada al margen en desktop **no
  existe** en el teléfono: no se puede leer ni mover. Hay que hacer que en móvil
  caigan de vuelta al grid/lista.
- **La nota no tiene relación real con el texto que anota:** guarda `textAnchor`
  (snapshot del texto) pero su posición es un **% libre** de la altura del
  documento. Si editas texto arriba, el % se queda igual pero la nota se desplaza
  respecto al párrafo del que hablaba. El excerpt y la posición visual terminan
  apuntando a sitios distintos. Esta es la diferencia entre "post-its decorativos
  que flotan" y "anotaciones de margen reales".

---

## 3. Decisión de diseño: modelo híbrido (anclado + libre)

### El insight

Un post-it físico en un cuaderno hace **dos cosas a la vez**:

- Está pegado a un punto del papel → al **scrollear** (mover la hoja) se mueve
  **con la hoja**. Eso es estar "linkeado", no un % de pantalla.
- Y aun así lo puedes **despegar y arrastrar** a donde quieras.

Por tanto "linkeado al texto" y "moverlo como sticky real" **no están en
conflicto**. Lo único que cambia entre los dos casos del usuario es **a qué se
pega la nota**: a una *línea de texto* o a un *punto en blanco del papel*.

### Modelo unificado

Cada nota está en uno de dos estados, y **en ambos se arrastra libre como un
post-it físico**:

| | **Anclada (a texto)** | **Libre (a un punto)** |
|---|---|---|
| Se pega a | una línea/selección del texto | un punto del papel |
| Al **scrollear** | viaja con la hoja | viaja con la hoja |
| Al **editar texto arriba** | baja con su párrafo (lo sigue) | se queda en su punto |
| **Arrastrar →** (horizontal) | desliza en el margen, sigue anclada | se mueve libre |
| **Arrastrar ↓** (vertical) | **se re-ancla a la línea más cercana** donde la sueltes | se mueve libre |
| Cómo nace | al crearla desde texto seleccionado | con el botón "+ Add" sin selección |
| Reversible | menú "Despegar del texto" → pasa a **libre** | menú "Pegar al texto cercano" → pasa a **anclada** |

Una línea/punto sutil conecta la nota anclada con su texto para que se vea el
vínculo.

### Decisiones cerradas con el usuario

- **Camino elegido:** híbrido (anclado + libre), no solo flotante ni solo anclado.
- **Drag vertical de una nota ANCLADA → se re-ancla a la línea más cercana** donde
  se suelte (mover = cambiar a qué texto está pegada). Despegarla a "libre" es una
  acción **explícita** del menú, no un efecto del arrastre. *(Elegido sobre
  "despegar al arrastrar" y sobre "ancla + offset vertical".)*
- Todas las correcciones de robustez ("route-1") van incluidas **sí o sí**, son
  ortogonales al modelo anclado/libre.

---

## 4. Modelo de datos final

Tabla `stickyNotes` en `src/shared/db/schema.ts`:

- `anchorId` (varchar, **nullable**, NUEVA) — id de la marca de ProseMirror.
  **No null = anclada; null = libre.** No hace falta una columna `mode` aparte.
- `positionX` (real, **NUEVA**) — offset horizontal como **fracción del gutter**
  (0 = pegado al borde de la columna de texto, 1 = borde exterior). Resiliente a
  resize y a toggling de sidebars.
- `positionY` (integer → **real**) — para notas **libres**, fracción precisa
  (decimal) de la altura del papel. Resuelve el problema de precisión.
- `positionSide` (se mantiene) — `left` | `right`: en qué gutter está.
- `textAnchor` (se mantiene) — excerpt visible en el card y en el fallback móvil.

> La Y de las notas **ancladas no se guarda**: se calcula en vivo con
> `editor.view.coordsAtPos(pos)` a partir de la posición de la marca `anchorId`.
> Por eso sigue al texto al editar/scrollear. ProseMirror mapea la posición de la
> marca a través de las ediciones automáticamente.

Unidades elegidas (resumen): X = fracción del gutter `[0,1]`; Y libre = fracción
de la altura del contenido `[0,1]` con decimales; Y anclada = derivada del editor.

---

## 5. Plan de ejecución por fases

Cada fase se **verifica** (build + comprobación visual del comportamiento) antes
de pasar a la siguiente. Alcance total: ~10–12 archivos + 1 migración.

### Fase A — Cimientos: datos + card + grid

- **Migración** (`npm run db:generate`): añadir `positionX` (real), cambiar
  `positionY` integer → real, añadir `anchorId` (varchar nullable).
- `sticky-notes.schemas.ts` / `sticky-notes.service.ts` / `sticky-notes.types.ts`:
  propagar `positionX`, `anchorId`, `positionY` real (`NOTE_COLUMNS`, create,
  update, zod).
- `StickyNoteCard.tsx`: crecer al contenido (texto completo,
  `whitespace-pre-wrap break-words`, **sin** `aspect-square` / `overflow-hidden` /
  `line-clamp`), tope de tamaño (max-width/altura razonable), rotación sutil
  (±1–3°, ambos sentidos).
- `StickyNotesGrid.tsx`: layout **masonry** (columnas) para alturas variables sin
  filas dentadas; en móvil el grid recibe **también** las notas de margen
  (ancladas y libres) para que no desaparezcan (mostrando su `textAnchor`).
- **Verificar:** build pasa; grid se ve bien; texto completo sin recorte; en móvil
  las notas de margen son visibles.

### Fase B — Drag libre 2D sólido (toda la robustez "route-1")

- `MarginNotesLayer.tsx`: **reemplazar dnd-kit por pointer-drag propio**:
  - Libre en X/Y en vivo (la nota sigue al cursor 1:1, sin transición durante el
    drag).
  - Clamp a los gutters → no puede taparse sobre el texto (se frena en el borde de
    la columna).
  - Clamp a los 4 bordes → no se pierde fuera de pantalla.
  - Traer-al-frente al tocar/arrastrar (z-order por interacción).
  - Pausar el polling (`refetchInterval`) mientras se arrastra; persistir posición
    precisa al soltar con update optimista → se queda **exacta**, sin salto.
- **Verificar:** arrastrar una nota libre y soltarla donde sea → se queda; no
  salta; no tapa texto; no se pierde; al solapar dos, la última queda al frente.

### Fase C — Anclaje a texto (lo "route-2")

- **Levantar el `useEditor` de Tiptap** para compartir la instancia entre
  `PageEditor.tsx` y `MarginNotesLayer.tsx` (subir estado a
  `NotebookEditorLayout` o un context). *(Refactor de fondo necesario: hoy el
  editor se crea local a `PageEditor`.)*
- Nueva **extensión mark `stickyAnchor`** (atributo `anchorId`); al crear una nota
  desde selección se aplica la marca con un id generado y se guarda en `anchorId`.
- Notas ancladas:
  - Y calculada con `coordsAtPos` de la posición de la marca.
  - Arrastre vertical → re-ancla a la línea de texto más cercana al punto de drop.
  - Toggle en el menú del card: "Despegar del texto" (anclada → libre) y "Pegar al
    texto cercano" (libre → anclada).
  - Línea conectora sutil entre la nota y su texto.
  - Manejo de **ancla huérfana** (texto borrado → no se encuentra la marca): la
    nota cae a "libre" en su última Y conocida.
- **Verificar:** crear nota desde selección → sigue al párrafo al editar arriba y
  al scrollear; arrastrarla a otra línea → se re-ancla; despegarla → queda libre;
  borrar el texto anclado → no rompe (cae a libre).

---

## 6. Notas de implementación / riesgos

- **No tocar nada fuera de `src/features/sticky-notes`** salvo: el schema/migración
  y levantar el editor en `PageEditor`/`NotebookEditorLayout` (Fase C).
- El grid sigue usando dnd-kit para apilar (`stackId`); solo el **margen** cambia a
  pointer-drag propio.
- `useUpdateStickyNote` ya tiene update optimista (`onMutate`) + invalidación en
  `onSettled`; reutilizarlo. El polling de 5s conviene pausarlo durante el drag (o
  reconsiderarlo: es una feature de un solo usuario, no necesita realtime).
- El contenido del editor se guarda como HTML; la marca de ProseMirror debe
  serializarse/parsearse en el HTML para que `anchorId` sobreviva al guardar/cargar
  (verificar render/parse de la mark en Tiptap).
- Migraciones: `npm run db:generate` crea el SQL en `drizzle/`; revisar el archivo
  generado antes de aplicar.

---

## 7. Checklist rápido de aceptación (al terminar las 3 fases)

- [ ] Arrastro una nota de margen libre en X **e** Y y se queda exacta donde la
      suelto (sin salto, sin animación de regreso).
- [ ] Una nota nunca se puede soltar encima del texto (se frena en el gutter).
- [ ] Una nota nunca se pierde fuera de pantalla.
- [ ] Al solapar dos notas, la que toco viene al frente.
- [ ] El texto de la nota se ve completo, con wrap, sin recorte.
- [ ] La nota no crece desproporcionadamente según el ancho de pantalla.
- [ ] La rotación es sutil y en ambos sentidos.
- [ ] En móvil, las notas de margen siguen visibles (caen al grid).
- [ ] Una nota anclada sigue a su párrafo al editar arriba y al scrollear.
- [ ] Arrastrar vertical una anclada la re-ancla a la línea más cercana.
- [ ] "Despegar / Pegar al texto" funciona (reversible).
- [ ] Borrar el texto anclado no rompe la nota (cae a libre).
