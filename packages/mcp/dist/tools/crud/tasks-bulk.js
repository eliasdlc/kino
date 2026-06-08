import { z } from 'zod';
export function registerTaskBulkTools(server, kinoFetch) {
    server.tool('bulk_move_tasks', 'Mueve múltiples tareas al mismo estado en una sola operación (máximo 50)', {
        taskIds: z.array(z.string().uuid()).min(1).max(50).describe('UUIDs de las tareas a mover'),
        status: z
            .enum(['backlog', 'week', 'tomorrow', 'today', 'done', 'archived'])
            .describe('Estado destino'),
    }, async (data) => {
        await kinoFetch('/api/tasks/bulk-move', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return {
            content: [{ type: 'text', text: JSON.stringify({ success: true, moved: data.taskIds.length, status: data.status }) }],
        };
    });
    server.tool('bulk_update_tasks', 'Actualiza la prioridad de múltiples tareas en una sola operación (máximo 50)', {
        taskIds: z.array(z.string().uuid()).min(1).max(50).describe('UUIDs de las tareas a actualizar'),
        priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Nueva prioridad'),
    }, async (data) => {
        await kinoFetch('/api/tasks/bulk-update', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        return {
            content: [{ type: 'text', text: JSON.stringify({ success: true, updated: data.taskIds.length, priority: data.priority }) }],
        };
    });
    server.tool('restore_task', 'Restaura una tarea previamente eliminada (soft-delete) en Kino, devolviéndola a la papelera al estado activo.', {
        taskId: z.string().uuid().describe('UUID de la tarea a restaurar'),
    }, async ({ taskId }) => {
        const task = await kinoFetch(`/api/tasks/${taskId}/restore`, { method: 'POST' });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    });
    server.tool('log_task_time', 'Registra una sesión de tiempo trabajada en una tarea (time log). Las fechas van en ISO 8601 UTC.', {
        taskId: z.string().uuid().describe('UUID de la tarea'),
        systemId: z.string().uuid().describe('UUID del sistema al que pertenece la tarea'),
        startedAt: z.string().datetime().describe('Inicio de la sesión en ISO 8601 (ej: 2026-06-07T09:00:00Z)'),
        endedAt: z.string().datetime().describe('Fin de la sesión en ISO 8601'),
        durationMinutes: z.number().int().min(0).describe('Duración en minutos'),
        source: z
            .enum(['timer', 'manual', 'pomodoro'])
            .optional()
            .describe('Origen del registro (por defecto "manual" desde el MCP)'),
    }, async ({ taskId, source, ...data }) => {
        await kinoFetch(`/api/tasks/${taskId}/time-log`, {
            method: 'POST',
            body: JSON.stringify({ ...data, source: source ?? 'manual' }),
        });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, taskId }) }] };
    });
}
