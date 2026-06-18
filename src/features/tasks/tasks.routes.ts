import { NextRequest, NextResponse } from "next/server";
import { bulkMoveSchema, bulkUpdateSchema, bulkCreateTaskSchema, listTasksQuerySchema, createTaskSchema, moveTaskSchema, moveBoardSchema, reorderTasksSchema, updateTaskSchema, createTimeLogSchema } from "./tasks.schemas";
import { bulkMoveTasks, bulkUpdateTasks, bulkCreateTasks, queryTasks, createTask, deleteTask, getSubtasks, getTaskById, getTasksBySystem, moveTask, moveTaskBoard, reorderTasks, restoreTask, toggleTask, updateTask, createTimeLog, getTimeLogSummary, ensureTodayPlanRolled } from "./tasks.service";
import { NotFoundError, ValidationError } from "@/shared/utils/error";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getSystembyId } from "@/features/systems/systems.service";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: systemId } = await params;
    try {
        // Rollover + reconcile diario lazy (gated 1×/día) antes de leer.
        await ensureTodayPlanRolled(ctx.userId);
        const system = await getSystembyId(systemId, ctx.userId);
        if (!system) return NextResponse.json({ code: 'NOT_FOUND'}, { status: 404 });

        const tasks = await getTasksBySystem(systemId, ctx.userId);
        return NextResponse.json(tasks);
    } catch {
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch tasks" }, { status: 500 });
    }
}

// GET /api/tasks/:id — fetch a single task by ID
export async function getById(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    try {
        const task = await getTaskById(taskId, ctx.userId);
        if (!task) return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        return NextResponse.json(task);
    } catch {
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch task" }, { status: 500 });
    }
}

export async function listTasks(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsed = listTasksQuerySchema.safeParse({
        systemId: searchParams.get("systemId") ?? undefined,
        energyLevel: searchParams.get("energyLevel") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        deleted: searchParams.get("deleted") === "true" ? true : undefined,
    });
    if (!parsed.success) {
        return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid query params", details: parsed.error.flatten() }, { status: 400 });
    }

    // Rollover + reconcile diario lazy (gated 1×/día) antes de leer.
    await ensureTodayPlanRolled(ctx.userId);
    const result = await queryTasks(ctx.userId, parsed.data);
    return NextResponse.json(result);
}

export async function postBulkCreate(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = bulkCreateTaskSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const created = await bulkCreateTasks(ctx.userId, parsed.data.tasks);
    return NextResponse.json(created, { status: 201 });
}

export async function POST(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        const task = await createTask(ctx.userId, parsed.data);
        return NextResponse.json(task, { status: 201 });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
        }
        throw error;
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        const task = await updateTask(id, ctx.userId, parsed.data);
        if (!task) return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        return NextResponse.json(task);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
        }
        if (error instanceof ValidationError) {
            return NextResponse.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 422 });
        }
        throw error;
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        await deleteTask(id, ctx.userId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        throw error;
    }
}

export async function postToggle(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        const result = await toggleTask(id, ctx.userId);
        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        if (error instanceof ValidationError) {
            return NextResponse.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 422 });
        }
        throw error;
    }
}

export async function patchMove(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = moveTaskSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        const task = await moveTask(id, parsed.data.status as import("./tasks.state-machine").TaskStatus, ctx.userId);
        return NextResponse.json(task);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        if (error instanceof ValidationError) {
            return NextResponse.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 422 });
        }
        throw error;
    }
}

export async function patchBoardMove(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = moveBoardSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        const task = await moveTaskBoard(id, parsed.data.boardStatus, ctx.userId);
        return NextResponse.json(task);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        if (error instanceof ValidationError) {
            return NextResponse.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 422 });
        }
        throw error;
    }
}

export async function getSubtasksRoute(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const subtasks = await getSubtasks(taskId, ctx.userId);
    return NextResponse.json(subtasks);
}

export async function postRestore(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        const task = await restoreTask(id, ctx.userId);
        return NextResponse.json(task);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        throw error;
    }
}

export async function postBulkMove(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = bulkMoveSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        await bulkMoveTasks(parsed.data.taskIds, parsed.data.status as import("./tasks.state-machine").TaskStatus, ctx.userId);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "One or more tasks not found" }, { status: 404 });
        }
        if (error instanceof ValidationError) {
            return NextResponse.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 422 });
        }
        throw error;
    }
}

export async function patchBulkUpdate(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    await bulkUpdateTasks(parsed.data.taskIds, { priority: parsed.data.priority }, ctx.userId);
    return new NextResponse(null, { status: 204 });
}

export async function postReorder(request: NextRequest) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = reorderTasksSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    await reorderTasks(ctx.userId, parsed.data.ids);
    return new NextResponse(null, { status: 204 });
}
export async function getTimeLogSummaryRoute(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    try {
        const summary = await getTimeLogSummary(taskId, ctx.userId);
        return NextResponse.json(summary);
    } catch {
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch time logs" }, { status: 500 });
    }
}

export async function postTimeLog(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const body = await request.json();
    const parsed = createTimeLogSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    try {
        await createTimeLog(taskId, ctx.userId, parsed.data);
        return new NextResponse(null, { status: 201 });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
        }
        throw error;
    }
}
