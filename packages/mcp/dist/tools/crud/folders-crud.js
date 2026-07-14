import { z } from 'zod';
const color = z
    .enum(['red', 'blue', 'pink', 'purple', 'green', 'orange', 'yellow', 'teal', 'gray', 'black', 'white'])
    .optional()
    .describe('Color de la carpeta');
export function registerFolderCrudTools(server, kinoFetch) {
    server.tool('list_folders', 'Lista las carpetas de un sistema en Kino (jerarquía de organización de tareas y páginas)', {
        systemId: z.string().uuid().describe('UUID del sistema'),
    }, async ({ systemId }) => {
        const folders = await kinoFetch(`/api/systems/${systemId}/folders`);
        return { content: [{ type: 'text', text: JSON.stringify(folders, null, 2) }] };
    });
    server.tool('get_folder_children', 'Lista las subcarpetas directas de una carpeta padre en Kino', {
        folderId: z.string().uuid().describe('UUID de la carpeta padre'),
    }, async ({ folderId }) => {
        const children = await kinoFetch(`/api/folders/${folderId}/children`);
        return { content: [{ type: 'text', text: JSON.stringify(children, null, 2) }] };
    });
    server.tool('list_folder_tasks', 'Lista las tareas asignadas directamente a una carpeta de un sistema', {
        systemId: z.string().uuid().describe('UUID del sistema'),
        folderId: z.string().uuid().describe('UUID de la carpeta'),
    }, async ({ systemId, folderId }) => {
        const tasks = await kinoFetch(`/api/systems/${systemId}/folders/${folderId}/tasks`);
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    });
    server.tool('create_folder', 'Crea una carpeta en un sistema de Kino. Puede anidarse bajo otra carpeta con parentId. Según el arquetipo del sistema, la carpeta es una clase (Academic: professor/schedule/semester), un milestone (Entrepreneurial: targetDate) o un área — esos campos van en metadata y el servidor los valida.', {
        systemId: z.string().uuid().describe('UUID del sistema al que pertenece la carpeta'),
        name: z.string().min(1).max(255).describe('Nombre de la carpeta'),
        color,
        parentId: z.string().uuid().optional().describe('UUID de la carpeta padre (para anidar)'),
        metadata: z
            .record(z.string(), z.any())
            .optional()
            .describe('Campos del rol de carpeta según el arquetipo (ej. { professor, schedule, semester } en Academic, { targetDate } en Entrepreneurial). Validado server-side.'),
    }, async ({ systemId, ...data }) => {
        const folder = await kinoFetch(`/api/systems/${systemId}/folders`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return { content: [{ type: 'text', text: JSON.stringify(folder, null, 2) }] };
    });
    server.tool('update_folder', 'Actualiza el nombre, color o metadata (campos del rol de carpeta según el arquetipo) de una carpeta en Kino', {
        folderId: z.string().uuid().describe('UUID de la carpeta a actualizar'),
        name: z.string().min(1).max(255).optional(),
        color,
        metadata: z
            .record(z.string(), z.any())
            .optional()
            .describe('Campos del rol de carpeta según el arquetipo. Reemplaza la metadata existente. Validado server-side.'),
    }, async ({ folderId, ...data }) => {
        const folder = await kinoFetch(`/api/folders/${folderId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        return { content: [{ type: 'text', text: JSON.stringify(folder, null, 2) }] };
    });
    server.tool('delete_folder', 'Elimina una carpeta de Kino', {
        folderId: z.string().uuid().describe('UUID de la carpeta a eliminar'),
    }, async ({ folderId }) => {
        await kinoFetch(`/api/folders/${folderId}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, folderId }) }] };
    });
}
