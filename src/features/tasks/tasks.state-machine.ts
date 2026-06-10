export type TaskStatus = "backlog" | "week" | "tomorrow" | "today" | "done" | "archived";
export type TransitionAction = "move_to_week" | "move_to_today" | "move_to_tomorrow" | "move_to_backlog" | "toggle_done" | "undo_done" | "soft_delete";

export interface TransitionContext {
    currentStatus: TaskStatus;
    action: TransitionAction;
    taskEnergyPoints: number;
    currentDayEnergyUsed: number;
    dailyEnergyLimit: number;
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
    | { type: "set_deleted_at"; value: Date }
    | { type: "grant_xp"; amount: number }
    | { type: "revert_xp"; amount: number };

const TRANSITION_MAP: Record<TaskStatus, Partial<Record<TransitionAction, TaskStatus>>> = {
    backlog: {
        move_to_week: "week",
        move_to_tomorrow: "tomorrow",
        move_to_today: "today",
        toggle_done: "done",
        soft_delete: "archived",
    },
    week: {
        move_to_today: "today",
        move_to_tomorrow: "tomorrow",
        move_to_backlog: "backlog",
        toggle_done: "done",
        soft_delete: "archived",
    },
    tomorrow: {
        move_to_today: "today",
        move_to_week: "week",
        move_to_backlog: "backlog",
        toggle_done: "done",
        soft_delete: "archived",
    },
    today: {
        move_to_tomorrow: "tomorrow",
        move_to_week: "week",
        toggle_done: "done",
        move_to_backlog: "backlog",
        soft_delete: "archived",
    },
    done: {
        undo_done: "today",
        soft_delete: "archived",
    },
    archived: {
        soft_delete: "archived",
    },
};

export function validateTransition(ctx: TransitionContext): TransitionResult {
    const allowedActions = TRANSITION_MAP[ctx.currentStatus];

    if (!allowedActions || !(ctx.action in allowedActions)) {
        return {
            valid: false,
            error: `Transición no válida: de '${ctx.currentStatus}' vía '${ctx.action}'`,
        };
    }

    if (ctx.action === "move_to_today") {
        const totalEnergyWouldBe = ctx.currentDayEnergyUsed + ctx.taskEnergyPoints;
        if (totalEnergyWouldBe > ctx.dailyEnergyLimit) {
            return {
                valid: false,
                error: `Límite de energía diario excedido (usaría ${totalEnergyWouldBe}, límite es ${ctx.dailyEnergyLimit})`,
            };
        }
    }

    const newStatus = allowedActions[ctx.action]!;
    const sideEffects = buildSideEffects(ctx.action, ctx.taskEnergyPoints);

    return {
        valid: true,
        newStatus,
        sideEffects,
    };
}

function buildSideEffects(action: TransitionAction, taskEnergyPoints: number): SideEffect[] {
    switch (action) {
        case "move_to_week":
        case "move_to_today":
        case "move_to_tomorrow":
        case "move_to_backlog":
            return [];

        case "toggle_done":
            return [
                { type: "set_completed_at", value: new Date() },
                { type: "grant_xp", amount: taskEnergyPoints },

            ];

        case "undo_done":
            return [
                { type: "clear_completed_at" },
                { type: "revert_xp", amount: taskEnergyPoints },

            ];

        case "soft_delete":
            return [
                { type: "set_deleted_at", value: new Date() },

            ];

        default:
            return [];
    }
}