import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../../client.js';

const energyLevel = z
  .enum(['high', 'medium', 'low'])
  .optional()
  .describe('Nivel de energía requerido: high (requiere concentración), medium, low (rutinario)');

const taskStatus = z
  .enum(['backlog', 'week', 'tomorrow', 'today', 'done', 'archived'])
  .optional()
  .describe(
    'Estado de la tarea. Si no se especifica startDate ni status, usa "week" para que la tarea aparezca en la Action View (hoy + 7 días). Usa "backlog" solo para ideas o trabajo sin fecha definida.',
  );

export function registerTaskCrudTools(server: McpServer) {
  server.tool(
    'list_tasks',
    'Lista tareas del usuario en Kino con filtros opcionales',
    {
      systemId: z.string().uuid().optional().describe('Filtrar por sistema (UUID)'),
      energyLevel: energyLevel,
      status: taskStatus,
    },
    async (filters) => {
      const params = new URLSearchParams();
      if (filters.systemId) params.set('systemId', filters.systemId);
      if (filters.energyLevel) params.set('energyLevel', filters.energyLevel);
      if (filters.status) params.set('status', filters.status);
      const tasks = await kinoFetch(`/api/tasks?${params.toString()}`);
      return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    },
  );

  server.tool(
    'get_task',
    'Obtiene el detalle completo de una tarea por su ID',
    {
      taskId: z.string().uuid().describe('UUID de la tarea'),
    },
    async ({ taskId }) => {
      const task = await kinoFetch(`/api/tasks/${taskId}`);
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'get_subtasks',
    'Lista las subtareas de una tarea padre',
    {
      taskId: z.string().uuid().describe('UUID de la tarea padre'),
    },
    async ({ taskId }) => {
      const subtasks = await kinoFetch(`/api/tasks/${taskId}/subtasks`);
      return { content: [{ type: 'text', text: JSON.stringify(subtasks, null, 2) }] };
    },
  );

  server.tool(
    'create_task',
    [
      'Crea una tarea en Kino.',
      'REGLA DE STATUS: Si no se especifica startDate ni status, usa status="week" para que la tarea',
      'aparezca en la Action View (vista principal). Solo usa status="backlog" para ideas o trabajo',
      'sin fecha. Si tienes una fecha de inicio, pásala en startDate y el status se derivará automáticamente.',
      'RECORDATORIOS: Si la tarea tiene dueDate, Kino enviará notificaciones push automáticamente',
      '(día anterior y día del vencimiento), siempre que el usuario tenga push habilitado.',
    ].join(' '),
    {
      title: z.string().min(1).max(500).describe('Título de la tarea'),
      systemId: z.string().uuid().describe('UUID del sistema al que pertenece la tarea'),
      description: z.string().optional().describe('Descripción detallada de la tarea'),
      energyLevel: energyLevel,
      status: taskStatus,
      dueDate: z
        .string()
        .date()
        .optional()
        .describe(
          'Fecha límite en formato YYYY-MM-DD. Si se define, el usuario recibirá recordatorios push automáticos.',
        ),
      priority: z
        .enum(['critical', 'high', 'medium', 'low'])
        .optional()
        .describe('Prioridad de la tarea (por defecto "medium" si se omite)'),
      parentTaskId: z.string().uuid().optional().describe('UUID de la tarea padre (para crear subtareas)'),
      folderId: z.string().uuid().optional().describe('UUID de la carpeta destino'),
      taskType: z
        .enum(['idea', 'reminder', 'project', 'todo'])
        .optional()
        .describe('Tipo de tarea. Las "idea" siempre van a backlog. Por defecto "todo" si se omite.'),
      estimatedTime: z
        .string()
        .optional()
        .describe('Tiempo estimado en formato HH:MM:SS (ej: 01:30:00)'),
      startDate: z
        .string()
        .date()
        .optional()
        .describe('Fecha de inicio en formato YYYY-MM-DD. Determina el status automáticamente.'),
    },
    async (data) => {
      // Default to "week" so tasks appear in the Action View, not buried in backlog
      const payload = {
        ...data,
        status: data.status ?? (data.taskType === 'idea' ? 'backlog' : 'week'),
      };
      const task = await kinoFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'bulk_create_tasks',
    [
      'Crea múltiples tareas en Kino en una sola operación (máximo 50).',
      'Para crear SUBTAREAS de una tarea padre, define parentTaskId en cada item',
      '(todas pueden apuntar al mismo padre). Útil tras generate_subtasks.',
    ].join(' '),
    {
      tasks: z
        .array(
          z.object({
            title: z.string().min(1).max(500),
            systemId: z.string().uuid(),
            description: z.string().optional(),
            energyLevel: z.enum(['high', 'medium', 'low']).optional(),
            status: z.enum(['backlog', 'week', 'tomorrow', 'today']).optional(),
            dueDate: z.string().date().optional(),
            priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
            parentTaskId: z
              .string()
              .uuid()
              .optional()
              .describe('UUID de la tarea padre — conviértela en subtarea'),
            folderId: z.string().uuid().optional().describe('UUID de la carpeta destino'),
            taskType: z.enum(['idea', 'reminder', 'project', 'todo']).optional(),
            estimatedTime: z.string().optional().describe('Tiempo estimado HH:MM:SS'),
            startDate: z.string().date().optional().describe('Fecha de inicio YYYY-MM-DD'),
          }),
        )
        .min(1)
        .max(50)
        .describe('Lista de tareas a crear'),
    },
    async ({ tasks }) => {
      const created = await kinoFetch('/api/tasks/bulk', {
        method: 'POST',
        body: JSON.stringify({ tasks }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] };
    },
  );

  server.tool(
    'update_task',
    'Actualiza campos de una tarea existente en Kino',
    {
      taskId: z.string().uuid().describe('UUID de la tarea a actualizar'),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      energyLevel: energyLevel,
      status: taskStatus,
      dueDate: z.string().date().nullable().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      folderId: z.string().uuid().nullable().optional().describe('UUID de carpeta (null para quitar)'),
      taskType: z.enum(['idea', 'reminder', 'project', 'todo']).nullable().optional(),
      estimatedTime: z.string().nullable().optional().describe('Tiempo estimado HH:MM:SS'),
      startDate: z.string().date().nullable().optional(),
    },
    async ({ taskId, ...data }) => {
      const task = await kinoFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'complete_task',
    'Marca una tarea como completada (o la descompletada si ya estaba hecha)',
    {
      taskId: z.string().uuid().describe('UUID de la tarea'),
    },
    async ({ taskId }) => {
      const task = await kinoFetch(`/api/tasks/${taskId}/toggle`, {
        method: 'POST',
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.tool(
    'delete_task',
    'Elimina una tarea de Kino (borrado lógico — la tarea queda en papelera, no se destruye)',
    {
      taskId: z.string().uuid().describe('UUID de la tarea a eliminar'),
    },
    async ({ taskId }) => {
      await kinoFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      return { content: [{ type: 'text', text: `Tarea ${taskId} eliminada correctamente.` }] };
    },
  );

  server.tool(
    'move_task',
    'Mueve una tarea a un estado diferente (backlog, week, tomorrow, today, done, archived)',
    {
      taskId: z.string().uuid().describe('UUID de la tarea'),
      status: z
        .enum(['backlog', 'week', 'tomorrow', 'today', 'done', 'archived'])
        .describe('Estado destino'),
    },
    async ({ taskId, status }) => {
      const task = await kinoFetch(`/api/tasks/${taskId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
    },
  );
}
