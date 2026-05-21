import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { bulkMoveSchema, bulkUpdateSchema, createTaskSchema, moveTaskSchema, reorderTasksSchema, updateTaskSchema } from "./tasks.schemas";
import { bulkMoveTasks, bulkUpdateTasks, createTask, deleteTask, getSubtasks, getTaskById, getTasksBySystem, moveTask, reorderTasks, restoreTask, toggleTask, updateTask } from "./tasks.service";
import { NotFoundError, ValidationError } from "@/shared/utils/error";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: systemId } = await params;
    try {
        const tasks = await getTasksBySystem(systemId, session.user.id);
        return NextResponse.json(tasks);
    } catch {
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch tasks" }, { status: 500 });
    }
}

// GET /api/tasks/:id — fetch a single task by ID
export async function getById(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    try {
        const task = await getTaskById(taskId, session.user.id);
        if (!task) return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        return NextResponse.json(task);
    } catch {
        return NextResponse.json({ code: "INTERNAL_ERROR", message: "Failed to fetch task" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

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
        const task = await createTask(session.user.id, parsed.data);
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

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
        const task = await updateTask(id, session.user.id, parsed.data);
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
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        await deleteTask(id, session.user.id);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        throw error;
    }
}

export async function postToggle(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        const result = await toggleTask(id, session.user.id);
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

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
        const task = await moveTask(id, parsed.data.status, session.user.id);
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
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const subtasks = await getSubtasks(taskId, session.user.id);
    return NextResponse.json(subtasks);
}

export async function postRestore(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        const task = await restoreTask(id, session.user.id);
        return NextResponse.json(task);
    } catch (error) {
        if (error instanceof NotFoundError) {
            return NextResponse.json({ code: "NOT_FOUND", message: "Task not found" }, { status: 404 });
        }
        throw error;
    }
}

export async function postBulkMove(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

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
        await bulkMoveTasks(parsed.data.taskIds, parsed.data.status, session.user.id);
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
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    await bulkUpdateTasks(parsed.data.taskIds, { priority: parsed.data.priority }, session.user.id);
    return new NextResponse(null, { status: 204 });
}

export async function postReorder(request: NextRequest) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = reorderTasksSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    await reorderTasks(session.user.id, parsed.data.ids);
    return new NextResponse(null, { status: 204 });
}