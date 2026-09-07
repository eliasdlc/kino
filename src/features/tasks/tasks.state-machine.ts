export type TaskStatus = "backlog" | "week" | "tomorrow" | "today" | "done";
export type TransitionAction = "move_to_week" | "move_to_today" | "move_to_tomorrow" | "move_to_backlog" | "toggle_done" | "undo_done";

export interface TransitionContext {
    currentStatus: TaskStatus;
    action: TransitionAction;
    isRecurring: boolean;
}

export interface TransitionResult {
    valid: boolean;
    newStatus?: TaskStatus;
    sideEffects?: SideEffect[];
    error?: string;
}

export type SideEffect =
    | { type: "set_completed_at"; value: Date }
    | { type: "clear_completed_at" }
    // Al completar una tarea recurrente se genera su siguiente ocurrencia. El
    // servicio lo maneja en applyTransition (necesita el Task y la tx).
    | { type: "generate_next_rrule_instance" };

// Borrado y restauración NO viven aquí: son papelera (deletedAt) vía
// deleteTask/restoreTask, un eje ortogonal al scheduling. Este mapa sólo
// gobierna las transiciones de status.
const TRANSITION_MAP: Record<TaskStatus, Partial<Record<TransitionAction, TaskStatus>>> = {
    backlog: {
        move_to_week: "week",
        move_to_tomorrow: "tomorrow",
        move_to_today: "today",
        toggle_done: "done",
    },
    week: {
        move_to_today: "today",
        move_to_tomorrow: "tomorrow",
        move_to_backlog: "backlog",
        toggle_done: "done",
    },
    tomorrow: {
        move_to_today: "today",
        move_to_week: "week",
        move_to_backlog: "backlog",
        toggle_done: "done",
    },
    today: {
        move_to_tomorrow: "tomorrow",
        move_to_week: "week",
        toggle_done: "done",
        move_to_backlog: "backlog",
    },
    done: {
        undo_done: "today",
    },
};

/**
 * Acción única que lleva de `from` a `to`, o null si no hay transición directa
 * (incluye el caso no-op `from === to`). Fuente única: el TRANSITION_MAP. Antes
 * había un mapa `from->to` duplicado a mano en el servicio que divergía y
 * producía 422 fantasma en movimientos válidos.
 */
export function actionForTransition(from: TaskStatus, to: TaskStatus): TransitionAction | null {
    if (from === to) return null;
    for (const [action, target] of Object.entries(TRANSITION_MAP[from])) {
        if (target === to) return action as TransitionAction;
    }
    return null;
}

/**
 * Valida una transición de status. Solo la forma del movimiento: el presupuesto
 * de energía NO se decide aquí.
 *
 * Hasta Fase 4.1 esta función rechazaba `move_to_today` cuando el día pasaba de
 * `dailyEnergyLimit` (→ 422). Se eliminó por D2: el sobregiro **avisa, jamás
 * bloquea**. Además el chequeo era doblemente mentiroso: sumaba los puntos de
 * las tareas ya completadas (castigaba trabajar, no sobre-prometer) y solo
 * corría por este camino, así que `PATCH { inTodayPlan: true }` nunca lo tocaba.
 * El presupuesto real vive en `energy.budget.ts` y se muestra, no se impone.
 */
export function validateTransition(ctx: TransitionContext): TransitionResult {
    const allowedActions = TRANSITION_MAP[ctx.currentStatus];

    if (!allowedActions || !(ctx.action in allowedActions)) {
        return {
            valid: false,
            error: `Transición no válida: de '${ctx.currentStatus}' vía '${ctx.action}'`,
        };
    }

    const newStatus = allowedActions[ctx.action]!;
    const sideEffects = buildSideEffects(ctx.action, ctx.isRecurring);

    return {
        valid: true,
        newStatus,
        sideEffects,
    };
}

function buildSideEffects(action: TransitionAction, isRecurring: boolean): SideEffect[] {
    switch (action) {
        case "move_to_week":
        case "move_to_today":
        case "move_to_tomorrow":
        case "move_to_backlog":
            return [];

        case "toggle_done":
            return isRecurring
                ? [
                      { type: "set_completed_at", value: new Date() },
                      { type: "generate_next_rrule_instance" },
                  ]
                : [{ type: "set_completed_at", value: new Date() }];

        case "undo_done":
            return [{ type: "clear_completed_at" }];

        default:
            return [];
    }
}

/**
 * Puente board ↔ scheduling (systemType `project`).
 *
 * El board kanban tiene su propio eje (columna de workflow), independiente del
 * `status` de scheduling. La ÚNICA columna que sincroniza con el scheduling es la
 * terminal (por convención, status_name='done'): mover una tarjeta ahí la completa
 * y sacarla de ahí la des-completa. El resto de columnas no tocan el scheduling.
 *
 * Devuelve la acción de scheduling a aplicar (vía `validateTransition`), o null si
 * el movimiento de columna no impacta el scheduling. Función pura → testeable.
 */
export function deriveBoardBridgeAction(
    scheduleStatus: TaskStatus,
    prevBoardStatus: string | null,
    nextBoardStatus: string,
    terminalColumn = "done",
): Extract<TransitionAction, "toggle_done" | "undo_done"> | null {
    const entersTerminal =
        nextBoardStatus === terminalColumn && prevBoardStatus !== terminalColumn;
    const leavesTerminal =
        prevBoardStatus === terminalColumn && nextBoardStatus !== terminalColumn;

    if (entersTerminal && scheduleStatus !== "done") return "toggle_done";
    if (leavesTerminal && scheduleStatus === "done") return "undo_done";
    return null;
}