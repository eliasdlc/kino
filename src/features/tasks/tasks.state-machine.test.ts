import { describe, it, expect } from "vitest";
import {
    validateTransition,
    deriveBoardBridgeAction,
    type TransitionContext,
    type TaskStatus,
    type TransitionAction,
} from "./tasks.state-machine";

function makeCtx(overrides: Partial<TransitionContext>): TransitionContext {
    return {
        currentStatus: "backlog",
        action: "move_to_week",
        taskEnergyPoints: 3,
        currentDayEnergyUsed: 0,
        dailyEnergyLimit: 50,
        isRecurring: false,
        ...overrides,
    };
}

describe("validateTransition", () => {
    describe("valid transitions", () => {
        const validTransitions: Array<[TaskStatus, TransitionAction, TaskStatus]> = [
            ["backlog", "move_to_week", "week"],
            ["backlog", "move_to_today", "today"],
            ["backlog", "toggle_done", "done"],
            ["backlog", "soft_delete", "archived"],
            ["week", "move_to_today", "today"],
            ["week", "move_to_backlog", "backlog"],
            ["week", "toggle_done", "done"],
            ["week", "soft_delete", "archived"],
            ["today", "toggle_done", "done"],
            ["today", "move_to_backlog", "backlog"],
            ["today", "move_to_week", "week"],
            ["today", "soft_delete", "archived"],
            ["done", "undo_done", "today"],
            ["done", "soft_delete", "archived"],
            ["archived", "soft_delete", "archived"],
        ];

        validTransitions.forEach(([currentStatus, action, expectedNewStatus]) => {
            it(`${currentStatus} + ${action} => ${expectedNewStatus}`, () => {
                const result = validateTransition(
                    makeCtx({
                        currentStatus: currentStatus as TaskStatus,
                        action: action as TransitionAction,
                    })
                );

                expect(result.valid).toBe(true);
                expect(result.newStatus).toBe(expectedNewStatus);
                expect(result.sideEffects).toBeDefined();
            });
        });
    });

    describe("invalid transitions", () => {
        const invalidTransitions: Array<[TaskStatus, TransitionAction]> = [
            ["done", "move_to_week"],
            ["done", "move_to_backlog"],
            ["done", "move_to_today"],
            ["done", "toggle_done"],
            ["today", "move_to_today"],
            ["week", "move_to_week"],
            ["week", "undo_done"],
            ["backlog", "move_to_backlog"],
            ["backlog", "undo_done"],
            ["archived", "move_to_week"],
            ["archived", "move_to_today"],
            ["archived", "move_to_backlog"],
            ["archived", "toggle_done"],
            ["archived", "undo_done"],
        ];

        invalidTransitions.forEach(([currentStatus, action]) => {
            it(`${currentStatus} + ${action} => invalid`, () => {
                const result = validateTransition(
                    makeCtx({
                        currentStatus: currentStatus as TaskStatus,
                        action: action as TransitionAction,
                    })
                );

                expect(result.valid).toBe(false);
                expect(result.error).toBeDefined();
            });
        });
    });

    describe("energy guard", () => {
        it("blocks move_to_today when energy would exceed limit", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "move_to_today",
                    taskEnergyPoints: 30,
                    currentDayEnergyUsed: 30,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain("Límite de energía diario excedido");
        });

        it("allows move_to_today when energy is exactly at limit", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "move_to_today",
                    taskEnergyPoints: 20,
                    currentDayEnergyUsed: 30,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(true);
            expect(result.newStatus).toBe("today");
        });

        it("allows move_to_today when under limit", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "move_to_today",
                    taskEnergyPoints: 10,
                    currentDayEnergyUsed: 20,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(true);
            expect(result.newStatus).toBe("today");
        });

        it("energy guard applies for backlog -> today", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "move_to_today",
                    taskEnergyPoints: 40,
                    currentDayEnergyUsed: 20,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(false);
        });

        it("energy guard applies for week -> today", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "week",
                    action: "move_to_today",
                    taskEnergyPoints: 40,
                    currentDayEnergyUsed: 20,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(false);
        });

        it("energy guard not applied for other actions", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "move_to_week",
                    taskEnergyPoints: 100,
                    currentDayEnergyUsed: 100,
                    dailyEnergyLimit: 50,
                })
            );

            expect(result.valid).toBe(true);
        });
    });

    describe("side effects", () => {
        it("toggle_done from TODAY produces set_completed_at + grant_xp", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "today",
                    action: "toggle_done",
                    taskEnergyPoints: 5,
                })
            );

            expect(result.valid).toBe(true);
            expect(result.sideEffects).toContainEqual({
                type: "set_completed_at",
                value: expect.any(Date),
            });
            expect(result.sideEffects).toContainEqual({
                type: "grant_xp",
                amount: 5,
            });
        });

        it("toggle_done from BACKLOG produces set_completed_at + grant_xp", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "toggle_done",
                    taskEnergyPoints: 7,
                })
            );

            expect(result.valid).toBe(true);
            expect(result.sideEffects).toContainEqual({
                type: "grant_xp",
                amount: 7,
            });
        });

        it("undo_done from DONE produces clear_completed_at + revert_xp", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "done",
                    action: "undo_done",
                    taskEnergyPoints: 4,
                })
            );

            expect(result.valid).toBe(true);
            expect(result.sideEffects).toContainEqual({
                type: "clear_completed_at",
            });
            expect(result.sideEffects).toContainEqual({
                type: "revert_xp",
                amount: 4,
            });
        });

        it("soft_delete produces set_deleted_at", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "today",
                    action: "soft_delete",
                })
            );

            expect(result.valid).toBe(true);
            expect(result.sideEffects).toContainEqual({
                type: "set_deleted_at",
                value: expect.any(Date),
            });
        });

        it("grant_xp amount equals taskEnergyPoints", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "backlog",
                    action: "toggle_done",
                    taskEnergyPoints: 8,
                })
            );

            const grantEffect = result.sideEffects?.find((e) => e.type === "grant_xp");
            expect(grantEffect?.type === "grant_xp" && grantEffect.amount).toBe(8);
        });

        it("revert_xp amount equals taskEnergyPoints", () => {
            const result = validateTransition(
                makeCtx({
                    currentStatus: "done",
                    action: "undo_done",
                    taskEnergyPoints: 6,
                })
            );

            const revertEffect = result.sideEffects?.find((e) => e.type === "revert_xp");
            expect(revertEffect?.type === "revert_xp" && revertEffect.amount).toBe(6);
        });

        it("move actions produce no side effects", () => {
            const moveActions: Array<[TaskStatus, TransitionAction]> = [
                ["backlog", "move_to_week"],
                ["backlog", "move_to_today"],
                ["week", "move_to_backlog"],
                ["week", "move_to_today"],
                ["today", "move_to_backlog"],
            ];

            moveActions.forEach(([currentStatus, action]) => {
                const result = validateTransition(
                    makeCtx({
                        currentStatus,
                        action,
                    })
                );

                expect(result.valid).toBe(true);
                expect(result.sideEffects).toEqual([]);
            });
        });
    });
});

describe("deriveBoardBridgeAction (puente board ↔ scheduling)", () => {
    it("entrar a la columna terminal (done) completa la tarea", () => {
        expect(deriveBoardBridgeAction("today", "in_progress", "done")).toBe("toggle_done");
        expect(deriveBoardBridgeAction("backlog", "review", "done")).toBe("toggle_done");
        expect(deriveBoardBridgeAction("week", null, "done")).toBe("toggle_done");
    });

    it("salir de la columna terminal reabre una tarea ya completada", () => {
        expect(deriveBoardBridgeAction("done", "done", "in_progress")).toBe("undo_done");
        expect(deriveBoardBridgeAction("done", "done", "todo")).toBe("undo_done");
    });

    it("moverse entre columnas no terminales no toca el scheduling", () => {
        expect(deriveBoardBridgeAction("today", "todo", "in_progress")).toBeNull();
        expect(deriveBoardBridgeAction("week", "in_progress", "review")).toBeNull();
        expect(deriveBoardBridgeAction("backlog", null, "todo")).toBeNull();
    });

    it("no re-completa si ya está done y sigue en la columna terminal", () => {
        expect(deriveBoardBridgeAction("done", "done", "done")).toBeNull();
    });

    it("entrar a terminal cuando ya está done (estado inconsistente) no re-dispara", () => {
        expect(deriveBoardBridgeAction("done", "review", "done")).toBeNull();
    });

    it("salir de terminal sin estar done no dispara undo", () => {
        expect(deriveBoardBridgeAction("today", "done", "in_progress")).toBeNull();
    });
});
