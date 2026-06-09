# Kino — Estado real de features

> Última actualización: 2026-06-08
>
> ✅ Hecho · 🟡 Parcial / en progreso · 🔮 Roadmap / no implementado

## Core

| Feature | Estado | Notas |
|---------|--------|-------|
| Autenticación (Better Auth) | ✅ | Sesiones PostgreSQL, HttpOnly cookies |
| CRUD de sistemas | ✅ | ltree, jerarquía, colores, íconos |
| CRUD de tareas | ✅ | Subtareas, prioridad, energía, tipo |
| API keys (MCP) | ✅ | Generación y revocación |
| MCP connector remoto | ✅ | OAuth 2.1, ~50 tools |
| Onboarding | 🟡 | Existe flujo básico, sin pulir |
| Sticky notes | 🟡 | CRUD implementado, sin captura rápida global |
| Pages (editor TipTap) | 🟡 | CRUD básico, sin slash commands ni bloques |
| Folders (jerarquía) | 🟡 | CRUD, sin drag-and-drop |
| Command palette | 🟡 | Existe, sin acciones completas |

## Dashboard y energía

| Feature | Estado | Notas |
|---------|--------|-------|
| Dashboard (layout) | 🟡 | Existe pero requiere scroll; no cabe en pantalla |
| "Plan de hoy" | 🟡 | Solo lectura — sin completar/mover/enfocar inline |
| Gráfica de energía | 🟡 | Existe pero sin marcador de hora actual; solo 1 checkin/día |
| Energy checkins | 🟡 | Un checkin por día; migración a multi-slot pendiente |
| EnergyAdvisorBanner | 🟡 | Backend `getTodayAdvisor` existe; componente no extraído |
| "Kino te conoce" | 🟡 | Muestra datos estáticos, sin correlación accionable |
| "Últimos 7 días" | 🟡 | Datos sin correlación; hardcoded sin guard de historial |

## /tasks

| Feature | Estado | Notas |
|---------|--------|-------|
| Lista de tareas | 🟡 | Grid con títulos cortados; sin vista lista; sin filtros |
| Plan sugerido por Kino | 🟡 | `insights.service.getSuggestedTasks` existe, no se usa en UI |
| Filtros por estado/prioridad/sistema | 🔮 | No implementados |
| Quest mode | 🔮 | No implementado |

## Formulario de tareas

| Feature | Estado | Notas |
|---------|--------|-------|
| CreateTaskDialog | 🟡 | Un solo form con todos los campos; sin pasos progresivos |
| EstimatedTime (pill selector) | 🔮 | Actualmente input numérico |
| `task_type` con comportamiento real | 🔮 | `idea/event/reminder/habit` ≡ `task` — sin diferencia funcional |

## Timer

| Feature | Estado | Notas |
|---------|--------|-------|
| FocusTimerWidget (básico) | 🟡 | Existe; sin auto-stop, sin sonido, sin Pomodoro |
| Pomodoro + modo Estimado + Libre | 🔮 | No implementado |
| Session recap (energy feedback) | 🔮 | No implementado |
| Visibilidad de tiempo acumulado | 🔮 | `timeLogs` capturados, nunca mostrados en UI |

## Sistemas por type

| Feature | Estado | Notas |
|---------|--------|-------|
| `system_type` como label cosmético | ✅ | El campo existe |
| `system_type` arquitectural (UI distinta por tipo) | 🔮 | Todos los sistemas usan la misma UI hoy |
| SystemAcademicView (Timeline) | 🔮 | No implementado |
| SystemProfessionalView (Kanban) | 🔮 | No implementado |
| SystemEntrepreneurialView (Milestones) | 🔮 | No implementado |
| SystemPersonalView (Lista flexible) | 🔮 | No implementado |
| SystemCustomView (Configurador) | 🔮 | No implementado |

## Notificaciones

| Feature | Estado | Notas |
|---------|--------|-------|
| Task reminders (push) | ✅ | Cron en GitHub Actions, escalada por prioridad |
| Notificaciones por `system_type` | 🔮 | Roadmap |

## Roadmap (sin código)

| Feature | Estado | Notas |
|---------|--------|-------|
| Billing / Premium / Lemon Squeezy | 🔮 | Solo columnas en schema |
| Sync adapters | 🔮 | Solo tabla `syncConnections` en schema |
| Quests / Inventory / Gamificación | 🔮 | Solo tablas en schema |
| Recurrencia (RRULE) | 🔮 | Solo columnas en schema |
| iCalendar import | 🔮 | Sin implementación |
| Integración Asana / Linear | 🔮 | Sin implementación |
| Integración Google Classroom | 🔮 | Sin implementación |
| Landing page y docs públicas | 🔮 | Sin implementación |
| Habit streaks | 🔮 | Depende de recurrencia |
| Context tags UI | 🔮 | Solo tabla en schema |
