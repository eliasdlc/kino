# Kino — Arquetipos de sistema · Julio 2026

> Documento de diseño y decisión (propuesta de **Rumbo 15**). Responde a: darle un propósito real a tasks/systems/folders/pages, que cada systemType sea una experiencia distinta, y añadir el arquetipo **Writing**. Continúa la numeración de decisiones de [`DECISIONES-2026-07.md`](./DECISIONES-2026-07.md) (D9–D16).

## 0. Diagnóstico: la diferenciación ya empezó, pero está desconectada

Lo que existe hoy, anclado al código:

| Pieza | Estado | Evidencia |
|---|---|---|
| Config por tipo | Existe pero decorativa | `SYSTEM_TYPE_CONFIG` (`shared/lib/system-types.ts:82-167`) declara `extraFields` (course, professor, kpi, milestone…) **que ninguna UI captura** |
| Cards por tipo | Cascarones vacíos | `TaskCardFor.tsx` rutea por tipo, pero `AcademicTaskCard`/`PersonalTaskCard`/`EntrepreneurialTaskCard` son passthroughs a `DefaultTaskCard` con un comentario "punto de extensión" |
| Vistas por tipo | 3 reales, 3 genéricas | Academic (semana+calendario), Project (kanban doble-eje, maduro), Entrepreneurial (milestones); personal/inbox/custom caen al funnel genérico (`SystemDetailView.tsx:38-47`) |
| Folders con rol | Un hack que valida la idea | Entrepreneurial ya usa folders como "milestones" (`SystemEntrepreneurialView.tsx:114-119`) — pero es un rename en una vista, no un concepto |
| Metadata | El vehículo existe, vacío | `tasks.metadata` jsonb (`schema.ts:657`) solo se usa para `generateStudyPlan`; **folders y pages no tienen columna metadata** |
| Pages | Un solo rol universal | Notebooks Tiptap idénticos en todos los sistemas |

Conclusión: no hay que inventar la arquitectura — hay que **conectar y completar** la que ya está sembrada, y dejar de hacerlo con forks de vistas.

---

## 1. La decisión central

### D9 · El "manifiesto de arquetipo": una sola config parametriza todo; se acaban los forks por tipo

**Decisión:** `SYSTEM_TYPE_CONFIG` se convierte en el **manifiesto de arquetipo** — la única fuente de verdad de cómo se comporta un tipo de sistema. Cada arquetipo declara:

```ts
type ArchetypeManifest = {
  label: string; icon: LucideIcon;
  vocabulary: { task: string; newTask: string; /* … */ };
  folderRole: { noun: string; nounPlural: string; icon: LucideIcon; fields: FieldDef[] } | null;
  pageRole: { noun: string; primary: boolean };   // primary → el sistema abre en pages, no en tasks
  taskKinds: TaskKindDef[];                        // qué "es" una tarea aquí (entrega, examen, capítulo…)
  cardBadges: BadgeDef[];                          // qué chips muestra la card
  view: ViewPreset;                                // composición de tabs/vistas (absorbe Rumbo 10)
  energyDefault, schedulingPreference, advisorTemplate, focusMinutes; // ya existen
};
```

Los componentes compartidos (`CreateTaskDialog`, `TaskCardFor`, `NewFolderInline`, `FoldersList`, `NotebooksList`, `SystemDetailView`) **leen el manifiesto** en vez de hardcodear por tipo. Añadir un arquetipo nuevo (Writing hoy, Fitness mañana) = escribir un manifiesto + a lo sumo una card, no una vista nueva de 200 líneas.

**Por qué:** el patrón actual (una vista fork por tipo) ya generó el problema que describes — 3 tipos ricos y 3 abandonados — porque cada diferenciación nueva cuesta una vista entera. Con manifiesto, la diferenciación es declarativa y el costo marginal de un arquetipo tiende a cero. Esto **absorbe Rumbo 10** (vistas intercambiables): `view` es un preset del manifiesto que el usuario puede override, igual que Custom ya hace con `tabs` en `systems.metadata` (`system-types.ts:40-45`).

**Consecuencia adicional:** el campo `emoji` del config muere — la UI usa solo iconos lucide (preferencia ya establecida: sin emojis).

**Alternativa rechazada:** seguir con vistas dedicadas por tipo (SystemWritingView.tsx, etc.). Es el camino que ya demostró no escalar: personal/inbox/custom llevan meses genéricos.

---

## 2. Qué es cada cosa en cada arquetipo (D10–D13)

### D10 · Folders: dejan de ser "carpetas" y pasan a ser el **contenedor con nombre propio** de cada arquetipo

**Decisión:** cada arquetipo define qué son sus folders, con campos propios en una columna nueva `folders.metadata` (jsonb). La tabla no cambia de forma — cambia de significado por contexto:

| Arquetipo | Folders son… | Campos (`folders.metadata`) | Nota |
|---|---|---|---|
| **Academic** | **Clases** | professor, horario (días+hora), semestre | Lo que los usuarios ya hacen a mano, hecho feature: la clase agrupa tareas y apuntes, muestra "próxima entrega" y horas invertidas (time_logs por folder) |
| **Entrepreneurial** | **Milestones** | targetDate | Formaliza el hack existente; targetDate habilita "milestone en riesgo" en el advisor |
| **Personal** | **Áreas** (salud, finanzas…) | — | Agrupación ligera, sin fechas ni presión |
| **Writing** | **Obras** (libro, blog, cómic, serie) | kind (book/blog/comic/other), wordGoal, targetDate opcional | Ver D12 |
| **Project** | **Ocultos** | — | Sprints + epics + categorías ya cubren la agrupación; dos sistemas de grouping simultáneos confunden |
| **Inbox** | **No existen** | — | El inbox es un funnel de triage, no un archivo; carpetas ahí = fricción |
| **Custom** | Carpetas genéricas | — | Escape hatch |

**Por qué:** "carpeta" es la abstracción de nadie. "Clase", "obra", "milestone" son las palabras que el usuario ya tiene en la cabeza — la UI debe hablar su idioma. El costo es mínimo: una columna jsonb + el manifiesto define noun y fields.

### D11 · Tasks: cada arquetipo define **qué clases de tarea existen** y su card muestra lo que importa ahí

**Decisión:** el manifiesto declara `taskKinds` — qué "es" una tarea en ese contexto — persistido en `tasks.metadata.kind` + campos por kind, **validado server-side con un Zod discriminado por systemType** (nada de jsonb basura). El `taskType` global (task/idea/event/reminder/epic) no cambia; el kind es la capa semántica del arquetipo encima.

| Arquetipo | Task kinds | La card muestra | La card deja de mostrar |
|---|---|---|---|
| **Academic** | entrega, examen, lectura, práctica | Chip de clase (color del folder), countdown a la fecha ("en 3 días"), icono del kind | — |
| **Project** | (ya tiene: epic, board, sprint) | Board status, sprint, epic — ya existe | — |
| **Entrepreneurial** | experimento, build, learning | Milestone al que pertenece, hipótesis (1 línea) | — |
| **Personal** | hábito (recurrente), recado, evento | Recurrencia, franja de energía sugerida | **Prioridad y due date agresivos** — personal no grita |
| **Writing** | escribir, revisar, outline, publicar | Obra + capítulo/pieza, meta de la sesión | Prioridad |
| **Inbox** | — (aún sin clasificar) | Botones de triage rápido: "¿a qué sistema va?" | Todo lo demás |

Las cards passthrough (`AcademicTaskCard` etc.) se vuelven reales, componiendo `parts/` existentes + los badges del manifiesto. `CreateTaskDialog` renderiza los campos del kind activo desde el manifiesto (por fin se usan los `extraFields` — depurados: fuera `syllabus`/`collaborators`/`kpi` especulativos, entra solo lo que una card muestra).

**Por qué:** "cada task se debe ver diferente en cada sistema" no significa 6 diseños — significa que cada contexto muestre **su** información crítica y esconda el ruido. Un examen se define por su countdown; un hábito por su racha; un capítulo por su obra. Misma fila base, badges distintos: consistencia visual + diferenciación semántica.

### D12 · Writing: el arquetipo nuevo, y el único **pages-first**

**Decisión:** se añade `writing` a `templateTypeEnum`. Su manifiesto:

- **Abre en la biblioteca, no en tareas.** `pageRole.primary = true`: la vista default es la lista de obras (folders) con sus manuscritos (pages) dentro — portada, progreso de palabras, última sesión. Las tareas son la vista secundaria ("revisar cap. 3", "outline arco 2").
- **Obras = folders** con `kind` (book/blog/comic/other) y `wordGoal`. La barra de progreso = **suma de palabras de las pages de la obra, calculada del contenido Tiptap** — derivada, nunca un contador paralelo (coherente con D1/D5: derivar > mantener).
- **Sesión de escritura = focus timer que ya existe** (`FocusTimerProvider` + `time_logs`), lanzada desde la obra: "45 min sobre Mi novela, 1.200 palabras". Palabras de la sesión = word count al cerrar − al abrir; historial de sesiones = time_logs. Cero tablas nuevas.
- **La energía es el diferenciador también aquí:** `schedulingPreference: 'peak'`, advisor: "Tu mejor ventana creativa es 9–11am — {obra} lleva {n} días sin sesión." Ninguna app de escritura (Scrivener, Ulysses, Notion) conecta el momento de escribir con tu curva de energía. Ese es el ángulo.
- **Streak de escritura** derivado de time_logs/updatedAt de pages — se muestra en el header de la obra, no se persiste.

**Qué NO es:** no compite con Scrivener en estructura de manuscrito (escenas, compilación, etc.). Es "tu vida de escritor dentro de tu vida completa" — la obra, su meta, tus sesiones, tu energía. El editor Tiptap actual (tablas, slash, imágenes por URL vía D8) es suficiente para el MVP.

**Por qué writing y no otro arquetipo:** (a) lo pediste; (b) es el nicho más desatendido — Scrivener es viejo y de pago, Notion es genérico, y las comunidades de escritores (NaNoWriMo, writing Twitter/Discord, blogueros indie) son densas y evangelizan mucho; (c) es la prueba de fuego perfecta del manifiesto: si el arquetipo más distinto (pages-first) sale barato, la arquitectura quedó bien.

### D13 · Pages: rol por arquetipo; solo Writing es pages-first

**Decisión:** el manifiesto define el noun y el lugar de las pages: **Apuntes** en Academic (colgados de la clase, acceso "apuntes de hoy" desde la vista), **Manuscritos** en Writing (centro), **Learnings** en Entrepreneurial (colgados del milestone), **Docs** en Project, **Notas** en Personal. Ninguna otra página cambia de motor — mismo editor, mismo `task_page_links`.

**Por qué:** el audit de features ya lo dijo: contra Notion no se compite en features de editor, se compite en **integración** (notas↔tareas↔tiempo↔energía). Una page de clase que muestra las entregas vinculadas y las horas invertidas es algo que Notion no da sin que el usuario lo construya a mano.

---

## 3. Negocio y crecimiento (D14–D15)

### D14 · Los arquetipos SON la estrategia de adquisición: onboarding segmentado + una landing por segmento

**Decisión:**
1. **Onboarding por identidad:** la primera pregunta pasa a ser "¿Qué te describe?" (Estudiante / Builder / Emprendedor / Escritor / Un poco de todo) → Kino crea el sistema del arquetipo con contenido de ejemplo realista (una clase con una entrega, una obra con un capítulo) y el tour habla el vocabulario del segmento. El `profileTypeEnum` actual (student/freelancer/corporate, `schema.ts:54-58`) se deriva de esta elección o se reemplaza — se decide al tocar onboarding.
2. **Una landing por arquetipo** en el route group `(marketing)`: `/para/estudiantes`, `/para/escritores`, `/para/builders` — mismo layout, copy e imágenes del segmento. SEO de nicho ("app para organizar el semestre", "app para escribir tu novela con constancia") es mucho más ganable que "productivity app".
3. **Canal por nicho:** los escritores y los estudiantes viven en comunidades concentradas (NaNoWriMo/writing Discords; studygram/studytok). Un arquetipo bien hecho + su landing = algo que esas comunidades comparten solas. Es la ruta de "muchos clientes" sin gastar en ads.

**Por qué:** "app de productividad para todos" es un mercado donde Notion/Todoist ya ganaron el genérico. "La app que entiende tu semestre / tu novela **y tu energía**" es una cuña por segmento que nadie ocupa. Cada manifiesto nuevo es literalmente un mercado nuevo con costo marginal bajo (eso es lo que compra D9).

### D15 · Pricing: gratis mientras crecemos; la palanca premium futura es la inteligencia, no los arquetipos

**Decisión (dirección, la cifra final es tuya):** todos los arquetipos son y seguirán siendo gratis — son la adquisición, capar el arquetipo es capar el crecimiento. La palanca premium natural, cuando toque, es lo que cuesta dinero servir o lo que es diferenciador puro: features de inteligencia/AI (planificación automática del día, generación de study plans), upload de imágenes (Blob, D8), y quizá historial largo de analytics de energía. Coherente con la decisión previa del marketing site (sin precios, roadmap "Pronto").

**Esto queda marcado como decisión de negocio tuya** en el momento de activarla; aquí solo queda decidida la arquitectura de la palanca (nada del core por arquetipo se diseña como "de pago").

### D16 · Inbox y Custom no se tocan (casi)

Inbox permanece plano y de triage — su única mejora viene de D11 (card con botones de clasificación rápida). Custom es el escape hatch y se beneficia gratis del manifiesto: elegir módulos (tabs, folder role on/off, page role) es la evolución natural de lo que ya hace con `systems.metadata.tabs`.

---

## 4. Estabilidad y seguridad (cómo esto no rompe nada)

1. **Secuencia:** nada de esto corre antes de la **Fase 0** de `DECISIONES-2026-07.md`. En particular: el valor `writing` del enum y `folders.metadata` son migraciones → **requieren DB-01 (rebaseline Drizzle) resuelto**; y los kinds referencian folders/parents → requieren **BE-03 (ownership)** cerrado.
2. **Metadata nunca es un saco:** todo `tasks.metadata`/`folders.metadata` entrante pasa por un **Zod discriminado por systemType en el servidor** (mismo rigor que el resto de la validación). Campos desconocidos se rechazan; el MCP (~50 tools) recibe los mismos schemas, así los agentes crean entregas/obras bien formadas.
3. **Cero contadores paralelos:** word counts, streaks, horas por clase — todo derivado de content/time_logs/completedAt. Misma filosofía que D1/D5: si se puede calcular, no se persiste.
4. **Sin tablas nuevas:** una columna jsonb en folders + un valor de enum. La superficie de migración es mínima a propósito.

## 5. UI (dirección)

- **Una sola familia visual, acento por arquetipo:** misma fila de task, mismos espaciados; cambia el badge set, el icono del kind y el vocabulario. La diferenciación se percibe en el contenido, no en 6 lenguajes visuales que romperían la coherencia.
- **Vocabulario en todos los CTAs:** "Nueva clase", "Nueva obra", "Nuevo milestone" — nunca "Nueva carpeta" dentro de un arquetipo.
- **Sin emojis** (preferencia ya establecida): el campo `emoji` del config sale; lucide icons por kind y por arquetipo.
- Mobile sigue las convenciones existentes (ResponsiveDialog, vistas `*MobileView`, sin DnD táctil).

---

## 6. Plan de ejecución — Rumbo 15 (4 sprints)

Se inserta en el roadmap de `DECISIONES-2026-07.md` como el grueso de la **Fase 2–3**, después de Fase 0 (confianza) y Fase 1 (limpieza). **Rumbo 10 desaparece como proyecto separado** (absorbido por D9).

**Sprint 1 — El manifiesto (M).** Extender `SYSTEM_TYPE_CONFIG` al `ArchetypeManifest`; migración `folders.metadata`; refactor de `NewFolderInline`/`FoldersList`/`SystemDetailView` a leer el manifiesto; folder roles vivos en Academic (**Clases** con professor/horario), Entrepreneurial (milestones formalizados con targetDate) y Personal (áreas). Project oculta folders; Inbox ya no los ofrece.

**Sprint 2 — Tasks diferenciadas (M).** `taskKinds` + Zod discriminado server-side; `CreateTaskDialog` renderiza campos del kind desde el manifiesto; cards reales: Academic (chip de clase + countdown), Personal (suave + recurrencia — se apoya en D7/Rumbo 12), Entrepreneurial (milestone + hipótesis), Inbox (triage rápido). Schemas expuestos también al MCP.

**Sprint 3 — Writing MVP (M–L).** Valor `writing` en el enum; manifiesto pages-first; vista biblioteca (obras → manuscritos, progreso de palabras derivado del Tiptap); sesión de escritura sobre el focus timer existente; advisor de ventana creativa; contenido de ejemplo del onboarding.

**Sprint 4 — Go-to-market (S–M).** Onboarding segmentado por identidad; landings `/para/*` en `(marketing)`; Custom configurable (módulos del manifiesto); pase de empty states con el vocabulario de cada arquetipo.

**Criterio de éxito del rumbo:** crear un arquetipo nuevo (p. ej. Fitness) debe costar ~1 día: un manifiesto + una card. Si cuesta más, D9 se implementó mal.
