# PLAN-06 — Recurrencia: de columnas vacías a motor inteligente

> Prioridad: 5
> Rama: `feat/plan-06-recurrence`
> Depende de: ninguno (Capa 1 es autónoma; Capa 2 depende de Capa 1)
> Desbloquea: Capa 2 requiere Capa 1 completa

---

## 1. Contexto y diagnóstico

### Estado real (peor de lo que parece)

La recurrencia no funciona en absoluto. No es "sin inteligencia" — es que no existe.

| Componente | Estado | Evidencia |
|---|---|---|
| Columnas DB | Existen | `tasks.recurrence_rule` (varchar 500), `tasks.recurrence_parent_id` (FK self-ref) |
| Índice | Existe | `idx_tasks_recurring` sobre `recurrenceRule IS NOT NULL` |
| Dependencia `rrule` | **No instalada** | No aparece en `package.json` |
| UI de creación | **No existe** | `CreateTaskDialog` y `TaskDetailSheet` no tienen campo de repetición; setean `recurrenceRule: null` hard-coded |
| Motor de spawn | **No implementado** | `generate_next_rrule_instance` en `tasks.state-machine.ts:29` marcado "Phase 3 — not implemented" |
| Inteligencia de patrones | **No existe** | No hay análisis de completion rate por tarea recurrente |

### Lo que sí existe y es útil

- `behaviorSnapshots` tiene `completionRate` (global, no por tarea recurrente).
- `energy.advisor.ts` tiene la arquitectura de pattern detection (útil para Capa 2).
- `recurrenceParentId` en schema permite agrupar instancias (historial por serie).
- El estado machine ya tiene la transición `toggle_done` — Capa 1 la extiende.

---

## 2. Objetivo y criterios de aceptación

### Capa 1 — Motor funcional (prerequisito)
- [ ] `rrule` instalado y verificado con `pnpm typecheck`.
- [ ] `CreateTaskDialog` y `TaskDetailSheet` tienen selector de repetición: Ninguna / Diaria / Semanal / Mensual / Personalizada (RRULE string).
- [ ] Al completar una tarea con `recurrenceRule`, el servicio genera la siguiente ocurrencia automáticamente.
- [ ] La siguiente ocurrencia tiene: mismo `title`, `systemId`, `energyLevel`, `priority`, `recurrenceRule`, `recurrenceParentId` apuntando al original de la serie.
- [ ] Solo se genera **una** ocurrencia a la vez (no se expande la serie completa).
- [ ] La tarea completada queda con `status: "done"`, `completedAt` fijado.
- [ ] Funciona dentro del límite de 10s de Vercel.

### Capa 2 — Inteligencia (requiere Capa 1 completa)
- [ ] `detectRecurrencePatterns(userId)` analiza series recurrentes y detecta "completion rate < 40% en últimas 5 ocurrencias".
- [ ] El advisor puede detectar el patrón `'destructive_habit'` y sugerirlo en el dashboard.
- [ ] Botón "Descomponer en subtareas" en `TaskDetailSheet` para tareas recurrentes que el sistema detecta como problemáticas.
- [ ] La descomposición usa la lógica existente del MCP `generate_subtasks` (re-expuesta en UI).
- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` pasan.

---

## 3. Decisiones de diseño

### Generación de la siguiente ocurrencia

Al llamar a `toggleTask(userId, taskId)` y la tarea pasa a `"done"`:

```typescript
if (task.recurrenceRule) {
  const nextDate = computeNextOccurrence(task.recurrenceRule, task.dueDate);
  if (nextDate) {
    await createRecurrenceInstance(userId, task, nextDate);
  }
}
```

`computeNextOccurrence(rrule, currentDueDate)`:
- Parsea el RRULE string con la librería `rrule`.
- Llama a `rule.after(currentDueDate ?? new Date())` para obtener la próxima fecha.
- Si no hay siguiente fecha (RRULE tiene COUNT o UNTIL que se agotó) → `null`.

`createRecurrenceInstance`: INSERT con mismos campos excepto:
- `id`: nuevo UUID (auto)
- `status`: `'today'` si la siguiente fecha es hoy, `'tomorrow'` si es mañana, else `'week'`
- `dueDate`: la fecha calculada
- `completedAt`: null
- `deletedAt`: null
- `recurrenceParentId`: `task.recurrenceParentId ?? task.id` (apuntar siempre al primer ancestro)
- `sortIndex`: 0 (se reordena luego)

**Por qué `recurrenceParentId ?? task.id`**: si la tarea que se completa ya es una instancia (tiene `recurrenceParentId`), la nueva instancia también apunta al padre original. Esto agrupa toda la serie bajo un único nodo raíz para análisis histórico.

### RRULE string en la UI

Los selectores de UI generan RRULE strings estándar:
```
Diaria: "FREQ=DAILY"
Semanal: "FREQ=WEEKLY;BYDAY=MO" (el día es el de la tarea)
Mensual: "FREQ=MONTHLY"
Personalizada: campo de texto libre validado con rrule.fromString()
```

La validación en el backend (Zod) verifica que el string parsea sin error con `rrule.fromString()` — si lanza, es inválido.

### Límite de 10s

`toggleTask` ya hace múltiples operaciones DB. Añadir una query de INSERT es aceptable — es una sola operación. El riesgo real sería si en algún momento se decide "generar las próximas 5 ocurrencias" — ese caso está explícitamente prohibido en este plan.

### Inteligencia de patrones (Capa 2)

Nueva función `analyzeRecurrenceHealth(userId)` que:
1. Obtiene todas las series recurrentes del usuario: `SELECT DISTINCT recurrence_parent_id FROM tasks WHERE recurrence_parent_id IS NOT NULL AND user_id = userId`.
2. Por cada serie: obtiene las últimas 5 instancias completadas/total generadas.
3. Calcula `completionRate = completadas / generadas`.
4. Devuelve series con `completionRate < 0.4` (patrón destructivo) o `completionRate = 0` en 3+ instancias (nunca se hace).

Formato de retorno similar a `AdvisorPattern` de `energy.advisor.ts`.

### Descomposición en subtareas (Capa 2)

El MCP tiene `decompose.ts` que genera subtareas. La UI necesita llamar a un endpoint que haga lo mismo sin pasar por el MCP. La lógica de descomposición (generar lista de subtareas dado un título) puede:

1. Ser una función pura determinista basada en el título (sin IA) — no requiere llamada externa.
2. O llamar a una IA — requiere API key y está fuera del scope $0/mes si se escala.

**Decisión**: para este plan, implementar versión determinista. El MCP puede seguir usando su propia lógica. Revisar `packages/mcp/src/tools/decompose.ts` para ver si tiene lógica reutilizable o si llama a una API externa. Si llama a API externa, la UI usará la versión determinista.

---

## 4. Cambios por capa

### CAPA 1

#### 4.1 Dependencia
```bash
pnpm add rrule
```
Verificar que `rrule` tiene tipos incluidos o instalar `@types/rrule`.

#### 4.2 Schemas — `src/features/tasks/tasks.schemas.ts`

Añadir campo `recurrenceRule` al schema de creación y actualización:
```typescript
recurrenceRule: z.string().max(500).nullable().optional()
  .refine(val => {
    if (!val) return true;
    try { RRule.fromString(val); return true; } catch { return false; }
  }, { message: 'RRULE string inválido' })
```

#### 4.3 Service — `src/features/tasks/tasks.service.ts`

Nueva función `computeNextOccurrence(rruleStr: string, fromDate: Date | null): Date | null`.

Ampliar `toggleTask`:
```typescript
// Después de aplicar la transición a "done":
if (result.isRecurring && task.recurrenceRule) {
  const nextDate = computeNextOccurrence(task.recurrenceRule, task.dueDate ? new Date(task.dueDate) : new Date());
  if (nextDate) {
    await createRecurrenceInstance(db, userId, task, nextDate);
  }
}
```

Nueva función `createRecurrenceInstance(db, userId, task, nextDate)` — encapsulada y testeable.

#### 4.4 UI — `src/features/tasks/RecurrencePicker.tsx` (nuevo)

Client Component. Select con opciones simples + campo personalizado:
```tsx
<Select>
  <SelectItem value="">Sin repetición</SelectItem>
  <SelectItem value="FREQ=DAILY">Diariamente</SelectItem>
  <SelectItem value="FREQ=WEEKLY">Semanalmente</SelectItem>
  <SelectItem value="FREQ=MONTHLY">Mensualmente</SelectItem>
  <SelectItem value="custom">Personalizar...</SelectItem>
</Select>
{isCustom && <Input placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR" />}
```

#### 4.5 UI — `CreateTaskDialog.tsx` y `TaskDetailSheet.tsx`

Añadir `<RecurrencePicker>` a ambos formularios. Mapear al campo `recurrenceRule` del schema.

En `TaskDetailSheet`, mostrar el recurrence actual (si existe) traducido a lenguaje natural usando `rrule.toText()`.

#### 4.6 MCP parity — Capa 1

No requiere cambios. El MCP no tiene tool de recurrencia actualmente.

---

### CAPA 2 (ejecutar después de Capa 1)

#### 4.7 Queries — `src/features/tasks/tasks.queries.ts` o nuevo `src/features/tasks/recurrence.queries.ts`

Nueva función `getRecurrenceSeriesStats(userId)`:
```typescript
interface SeriesStats {
  parentId: string;
  parentTitle: string;
  totalInstances: number;
  completedInstances: number;
  completionRate: number;
  lastInstanceAt: Date | null;
}
```

#### 4.8 Service — ampliar `energy.advisor.ts` o nuevo `src/features/tasks/recurrence.advisor.ts`

Nueva función `detectDestructiveRecurrence(series: SeriesStats[]): AdvisorPattern | null`.

Criterio: `completionRate < 0.4 AND totalInstances >= 5` → patrón `'destructive_habit'`.

Mensaje: `"Tienes tareas recurrentes que raramente terminas. ¿Las descomponemos en partes más pequeñas?"`.

#### 4.9 Service — ampliar el advisor principal

`getTodayAdvisor` en `energy.service.ts` actualmente detecta 4 patrones (overload, abandonment, disorganization, underuse). Añadir detección de `destructive_habit` al pool de candidatos.

#### 4.10 UI — `TaskDetailSheet.tsx`

Para tareas con `recurrenceRule` y `completionRate` bajo (si está disponible en el contexto):
```tsx
{isRecurring && lowCompletionRate && (
  <Button variant="outline" onClick={() => generateSubtasks(task.id)}>
    Descomponer en subtareas
  </Button>
)}
```

#### 4.11 Service — `src/features/tasks/tasks.service.ts`

Nueva función `generateSubtasksForRecurring(userId, taskId)`:
- Genera 3-5 subtareas deterministas basadas en el título de la tarea padre.
- Heurística: descomposición por etapas (planificar, ejecutar, revisar, etc.) o por verbo del título.
- INSERT INTO tasks con `parentTaskId = taskId`.

---

## 5. Plan de commits

### CAPA 1

#### Commit 1 — `chore(deps): instalar rrule`
```bash
pnpm add rrule
```
Archivo: `package.json`, `pnpm-lock.yaml`

#### Commit 2 — `feat(tasks): validación Zod de recurrenceRule con rrule.fromString`
Archivos: `src/features/tasks/tasks.schemas.ts`

#### Commit 3 — `feat(tasks): computeNextOccurrence y createRecurrenceInstance`
Archivos: `src/features/tasks/tasks.service.ts`

Incluye tests unitarios para `computeNextOccurrence`.

#### Commit 4 — `feat(tasks): spawn automático de siguiente instancia en toggleTask`
Archivos: `src/features/tasks/tasks.service.ts`

Test de integración: toggle tarea recurrente → nueva instancia creada.

#### Commit 5 — `feat(tasks): RecurrencePicker component`
Archivos: `src/features/tasks/RecurrencePicker.tsx` (nuevo)

#### Commit 6 — `feat(tasks): recurrencia en CreateTaskDialog y TaskDetailSheet`
Archivos:
- `src/features/tasks/CreateTaskDialog.tsx`
- `src/features/tasks/TaskDetailSheet.tsx`

Mostrar la regla actual en lenguaje natural con `RRule.fromString(rule).toText()`.

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

### CAPA 2 (después de Capa 1 commiteada)

#### Commit 7 — `feat(tasks): query getRecurrenceSeriesStats`
Archivos: `src/features/tasks/recurrence.queries.ts` (nuevo)

#### Commit 8 — `feat(tasks): detector de patrón destructive_habit en recurrencia`
Archivos: nuevo `src/features/tasks/recurrence.advisor.ts` (o ampliar `energy.advisor.ts`)

Incluye tests unitarios: `completionRate 0.3 + 5 instancias → detecta patrón`.

#### Commit 9 — `feat(energy): integrar destructive_habit en getTodayAdvisor`
Archivos: `src/features/energy/energy.service.ts`

#### Commit 10 — `feat(tasks): generateSubtasksForRecurring`
Archivos: `src/features/tasks/tasks.service.ts`

#### Commit 11 — `feat(tasks): botón "Descomponer" en TaskDetailSheet para recurrentes problemáticas`
Archivos: `src/features/tasks/TaskDetailSheet.tsx`

Verificar: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`

---

## 6. Tests

### Unitarios — `computeNextOccurrence`
```
✓ FREQ=DAILY desde 2026-06-01 → 2026-06-02
✓ FREQ=WEEKLY desde lunes → próximo lunes
✓ FREQ=MONTHLY desde el 15 → el 15 del mes siguiente
✓ RRULE con COUNT=3 agotado → null
✓ RRULE con UNTIL pasado → null
✓ RRULE inválido → error controlado (no crash)
```

### Unitarios — `createRecurrenceInstance`
```
✓ recurrenceParentId se hereda del ancestro, no del padre inmediato
✓ status es 'today' si nextDate es hoy
✓ status es 'tomorrow' si nextDate es mañana
✓ status es 'week' en otro caso
✓ completedAt es null en la nueva instancia
```

### Unitarios — Capa 2 advisor
```
✓ 5 instancias, 1 completada → detecta destructive_habit
✓ 5 instancias, 3 completadas → no detecta
✓ menos de 5 instancias → no detecta (datos insuficientes)
```

---

## 7. Checklist de seguridad

- [ ] `userId` de sesión en `toggleTask` (ya existente)
- [ ] `createRecurrenceInstance` recibe `userId` desde sesión, no de la tarea
- [ ] Validación Zod del RRULE string en creación y actualización
- [ ] `recurrenceParentId` no se puede setear desde el cliente (solo el servicio lo asigna)
- [ ] El endpoint de `generateSubtasksForRecurring` verifica propiedad de la tarea

---

## 8. Riesgos y gotchas

- **`rrule` y timezones**: `rrule.after(date)` opera en UTC. Si la tarea tiene `dueDate` (DATE, zona del usuario según AGENTS.md), hay que convertir correctamente antes de pasar a rrule. Usar `new Date(dueDate + 'T00:00:00Z')` como aproximación, o añadir timezone al cálculo.
- **Vercel 10s**: `toggleTask` con spawn es una operación adicional de INSERT. En condiciones normales < 200ms. Riesgo real: si hay cascade de hooks (xp, system_health) configurados en el state machine Phase 2. Monitorear con logs.
- **`recurrenceParentId` en el cliente**: el schema Zod de actualización de tareas no debe incluir `recurrenceParentId` como campo editable por el cliente. Es un campo interno del motor.
- **`rrule.toText()` en inglés**: la librería genera texto en inglés por defecto. Para la UI en español, hay que pasar la localización de rrule (`RRule.SPANISH` si existe) o generar el texto manual para los casos simples (diario/semanal/mensual).
- **Descomposición determinista (Capa 2)**: la heurística de subtareas debe ser lo suficientemente útil para no ser embarazosa. Si el título es muy corto ("Ejercicio"), las subtareas genéricas ("Planificar", "Ejecutar", "Revisar") funcionan. Si el título es específico, el resultado puede ser redundante. Documentar la limitación en la UI ("Subtareas sugeridas — edítalas según necesites").
- **MCP `generate_subtasks` vs service**: revisar `packages/mcp/src/tools/decompose.ts` antes de implementar la versión del service — si usa la misma lógica determinista, refactorizar para que ambos importen desde el service. Si el MCP llama a una API externa (LLM), mantenerlos separados.
