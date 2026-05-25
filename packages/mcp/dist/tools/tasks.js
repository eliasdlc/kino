import { z } from 'zod';
import { kinoFetch } from '../client.js';
const energyLevel = z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe('Nivel de energía requerido: high (requiere concentración), medium, low (rutinario)');
const taskStatus = z
    .enum(['backlog', 'week', 'tomorrow', 'today', 'done', 'archived'])
    .optional()
    .describe('Estado de la tarea');
export function registerTaskTools(server) {
    server.tool('list_tasks', 'Lista tareas del usuario en Kino con filtros opcionales', {
        systemId: z.string().uuid().optional().describe('Filtrar por sistema (UUID)'),
        energyLevel: energyLevel,
        status: taskStatus,
    }, async (filters) => {
        const params = new URLSearchParams();
        if (filters.systemId)
            params.set('systemId', filters.systemId);
        if (filters.energyLevel)
            params.set('energyLevel', filters.energyLevel);
        if (filters.status)
            params.set('status', filters.status);
        const tasks = await kinoFetch(`/api/tasks?${params.toString()}`);
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    });
    server.tool('create_task', 'Crea una tarea en Kino', {
        title: z.string().min(1).max(500).describe('Título de la tarea'),
        systemId: z.string().uuid().describe('UUID del sistema al que pertenece la tarea'),
        description: z.string().optional().describe('Descripción detallada de la tarea'),
        energyLevel: energyLevel,
        status: taskStatus,
        dueDate: z.string().date().optional().describe('Fecha límite en formato YYYY-MM-DD'),
        priority: z
            .enum(['critical', 'high', 'medium', 'low'])
            .optional()
            .describe('Prioridad de la tarea'),
    }, async (data) => {
        const task = await kinoFetch('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    });
    server.tool('bulk_create_tasks', 'Crea múltiples tareas en Kino en una sola operación (máximo 50)', {
        tasks: z
            .array(z.object({
            title: z.string().min(1).max(500),
            systemId: z.string().uuid(),
            description: z.string().optional(),
            energyLevel: z.enum(['high', 'medium', 'low']).optional(),
            status: z.enum(['backlog', 'week', 'tomorrow', 'today']).optional(),
            dueDate: z.string().date().optional(),
            priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        }))
            .min(1)
            .max(50)
            .describe('Lista de tareas a crear'),
    }, async ({ tasks }) => {
        const created = await kinoFetch('/api/tasks/bulk', {
            method: 'POST',
            body: JSON.stringify({ tasks }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
    });
    server.tool('update_task', 'Actualiza campos de una tarea existente en Kino', {
        taskId: z.string().uuid().describe('UUID de la tarea a actualizar'),
        title: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        energyLevel: energyLevel,
        status: taskStatus,
        dueDate: z.string().date().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    }, async ({ taskId, ...data }) => {
        const task = await kinoFetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    });
    server.tool('complete_task', 'Marca una tarea como completada (o la descompletada si ya estaba hecha)', {
        taskId: z.string().uuid().describe('UUID de la tarea'),
    }, async ({ taskId }) => {
        const task = await kinoFetch(`/api/tasks/${taskId}/toggle`, {
            method: 'POST',
        });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    });
    server.tool('delete_task', 'Elimina una tarea de Kino (borrado lógico — la tarea queda en papelera, no se destruye)', {
        taskId: z.string().uuid().describe('UUID de la tarea a eliminar'),
    }, async ({ taskId }) => {
        await kinoFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Tarea ${taskId} eliminada correctamente.` }] };
    });
    server.tool('move_task', 'Mueve una tarea a un estado diferente (backlog, week, tomorrow, today, done, archived)', {
        taskId: z.string().uuid().describe('UUID de la tarea'),
        status: z
            .enum(['backlog', 'week', 'tomorrow', 'today', 'done', 'archived'])
            .describe('Estado destino'),
    }, async ({ taskId, status }) => {
        const task = await kinoFetch(`/api/tasks/${taskId}/move`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    });
}
