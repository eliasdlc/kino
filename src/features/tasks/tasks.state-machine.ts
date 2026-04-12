export type TaskStatus = "backlog" | "week" | "today" | "done" | "archived";
export type TransitionAction = "move_to_week" | "move_to_today" | "move_to_backlog" | "toggle_done" | "undo_done" | "soft_delete";

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
    | { type: "revert_xp"; amount: number }
    // Planned — not yet implemented in tasks.service.ts:
    | { type: "update_sort_index" }       // Phase 2: drag-and-drop reorder
    | { type: "update_system_health" }    // Phase 2: system health recalculation
    | { type: "generate_next_rrule_instance" }; // Phase 3: recurring tasks

const TRANSITION_MAP: Record<TaskStatus, Partial<Record<TransitionAction, TaskStatus>>> = {
    backlog: {
        move_to_week: "week",
        move_to_today: "today",
        toggle_done: "done",
        soft_delete: "archived",
    },
    week: {
        move_to_today: "today",
        move_to_backlog: "backlog",
        toggle_done: "done",
        soft_delete: "archived",
    },
    today: {
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
            error: `Cannot perform '${ctx.action}' on task in '${ctx.currentStatus}' status`,
        };
    }

    if (ctx.action === "move_to_today") {
        const totalEnergyWouldBe = ctx.currentDayEnergyUsed + ctx.taskEnergyPoints;
        if (totalEnergyWouldBe > ctx.dailyEnergyLimit) {
            return {
                valid: false,
                error: `Daily energy limit exceeded (would use ${totalEnergyWouldBe}, limit is ${ctx.dailyEnergyLimit})`,
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
        case "move_to_backlog":
            return [{ type: "update_sort_index" }, { type: "update_system_health" }];

        case "toggle_done":
            return [
                { type: "set_completed_at", value: new Date() },
                { type: "grant_xp", amount: taskEnergyPoints },
                { type: "update_system_health" },
            ];

        case "undo_done":
            return [
                { type: "clear_completed_at" },
                { type: "revert_xp", amount: taskEnergyPoints },
                { type: "update_system_health" },
            ];

        case "soft_delete":
            return [
                { type: "set_deleted_at", value: new Date() },
                { type: "update_system_health" },
            ];

        default:
            return [];
    }
}