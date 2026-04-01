type TaskStatus = "backlog" | "week" | "today" | "done" | "archived";
type TransitionAction = "move_to_week" | "move_to_today" | "move_to_backlog" | "toggle_done" | "undo_done" | "soft_delete" | "archive";

interface TransitionContext {
    currentStatus: TaskStatus;
    action: TransitionAction;
    taskEnergyPoints: number;
    currentDayEnergyUsed: number;  // suma de energy_points de tareas en TODAY hoy
    dailyEnergyLimit: number;      // de user_settings
    isRecurring: boolean;
}

interface TransitionResult {
    valid: boolean;
    newStatus?: TaskStatus;
    sideEffects?: SideEffect[];
    error?: string;
}

type SideEffect =
    | { type: "set_completed_at"; value: Date }
    | { type: "clear_completed_at" }
    | { type: "set_deleted_at"; value: Date }
    | { type: "grant_xp"; amount: number }
    | { type: "revert_xp"; amount: number }
    | { type: "update_sort_index" }
    | { type: "update_system_health" }
    | { type: "generate_next_rrule_instance" };

export function validateTransition(ctx: TransitionContext): TransitionResult {
    switch (ctx.action) {
        case "move_to_week":
            return {
                valid: true,
                newStatus: "week",
                sideEffects: [
                    { type: "update_sort_index" },
                    { type: "update_system_health" }
                ]
            };
        case "move_to_today":
            return {
                valid: true,
                newStatus: "today",
                sideEffects: [
                    { type: "update_sort_index" },
                    { type: "update_system_health" }
                ]
            };
        case "move_to_backlog":
            return {
                valid: true,
                newStatus: "backlog",
                sideEffects: [
                    { type: "update_sort_index" },
                    { type: "update_system_health" }
                ]
            };
        case "toggle_done":
            return {
                valid: true,
                newStatus: "done",
                sideEffects: [
                    { type: "set_completed_at", value: new Date() },
                    { type: "grant_xp", amount: ctx.taskEnergyPoints },
                    { type: "update_system_health" }
                ]
            };
        case "undo_done":
            return {
                valid: true,
                newStatus: "today",
                sideEffects: [
                    { type: "clear_completed_at" },
                    { type: "revert_xp", amount: ctx.taskEnergyPoints },
                    { type: "update_system_health" }
                ]
            };
        case "soft_delete":
            return {
                valid: true,
                newStatus: "archived",
                sideEffects: [
                    { type: "set_deleted_at", value: new Date() },
                    { type: "update_system_health" }
                ]
            };
        case "archive":
            return {
                valid: true,
                newStatus: "archived",
                sideEffects: [
                    { type: "set_deleted_at", value: new Date() },
                    { type: "update_system_health" }
                ]
            };
        default:
            return { valid: false, error: "Invalid transition action" };
    }
}