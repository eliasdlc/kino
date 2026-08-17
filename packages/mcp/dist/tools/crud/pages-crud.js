import { z } from 'zod';
import { markdownToHtml } from '../../utils/markdown.js';
import { appendMarkdown, assertPageVersion, pageAsMarkdown, parseStoredPage, } from '../../utils/page-content.js';
export function registerPageCrudTools(server, kinoFetch) {
    server.tool('list_pages', 'Lista las páginas (notas markdown) de un sistema en Kino', {
        systemId: z.string().uuid().describe('UUID del sistema'),
    }, async ({ systemId }) => {
        const pages = await kinoFetch(`/api/pages?systemId=${systemId}`);
        return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] };
    });
    server.tool('create_page', 'Crea una página markdown en un sistema de Kino', {
        title: z.string().max(500).optional().describe('Título de la página'),
        content: z.string().optional().describe('Contenido en markdown (se convierte a HTML al guardar para que el editor lo renderice correctamente)'),
        systemId: z.string().uuid().describe('UUID del sistema al que pertenece'),
        folderId: z.string().uuid().optional().describe('UUID de la carpeta (opcional)'),
    }, async ({ content, ...rest }) => {
        const payload = content !== undefined
            ? { ...rest, content: markdownToHtml(content) }
            : rest;
        const page = await kinoFetch('/api/pages', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }] };
    });
    server.tool('get_page', 'Obtiene el contenido completo de una página (título, markdown, tasks vinculados)', {
        pageId: z.string().uuid().describe('UUID de la página'),
    }, async ({ pageId }) => {
        const page = await kinoFetch(`/api/pages/${pageId}`);
        return { content: [{ type: 'text', text: JSON.stringify(pageAsMarkdown(page), null, 2) }] };
    });
    server.tool('update_page', 'Actualiza una página de Kino: título, contenido markdown, carpeta o estado de pin', {
        pageId: z.string().uuid().describe('UUID de la página a actualizar'),
        title: z.string().max(500).nullable().optional().describe('Nuevo título (null para borrar)'),
        content: z.string().nullable().optional().describe('Contenido completo en markdown (null para borrar; se convierte a HTML al guardar para que el editor lo renderice correctamente)'),
        expectedUpdatedAt: z.iso.datetime({ offset: true }).optional().describe('Versión updatedAt devuelta por get_page. Es obligatoria cuando se reemplaza content'),
        folderId: z.string().uuid().nullable().optional().describe('UUID de la carpeta destino (null para quitar de carpeta)'),
        isPinned: z.boolean().optional().describe('Fijar o desfijar la página'),
    }, async ({ pageId, content, expectedUpdatedAt, ...rest }) => {
        if (content !== undefined && expectedUpdatedAt === undefined) {
            throw new Error('expectedUpdatedAt is required when update_page replaces content. Call get_page first.');
        }
        const payload = content !== undefined
            ? { ...rest, content: markdownToHtml(content), expectedUpdatedAt }
            : rest;
        const updated = await kinoFetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
        const result = content !== undefined ? pageAsMarkdown(updated) : updated;
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    });
    server.tool('append_page_content', 'Añade Markdown al final de una página sin sobrescribir cambios hechos después de la última lectura', {
        pageId: z.string().uuid().describe('UUID de la página'),
        content: z.string().min(1).describe('Markdown que se añadirá al final'),
        expectedUpdatedAt: z.iso.datetime({ offset: true }).describe('Versión updatedAt devuelta por get_page'),
    }, async ({ pageId, content, expectedUpdatedAt }) => {
        const stored = parseStoredPage(await kinoFetch(`/api/pages/${pageId}`));
        assertPageVersion(stored, expectedUpdatedAt);
        const markdown = pageAsMarkdown(stored).content;
        const updated = await kinoFetch(`/api/pages/${pageId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                content: markdownToHtml(appendMarkdown(markdown, content)),
                expectedUpdatedAt,
            }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(pageAsMarkdown(updated), null, 2) }] };
    });
    server.tool('delete_page', 'Elimina (soft-delete) una página de Kino', {
        pageId: z.string().uuid().describe('UUID de la página a eliminar'),
    }, async ({ pageId }) => {
        await kinoFetch(`/api/pages/${pageId}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, pageId }) }] };
    });
    server.tool('list_page_tasks', 'Lista las tareas vinculadas a una página de Kino', {
        pageId: z.string().uuid().describe('UUID de la página'),
    }, async ({ pageId }) => {
        const tasks = await kinoFetch(`/api/pages/${pageId}/tasks`);
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
    });
    server.tool('link_task_to_page', 'Vincula una tarea existente a una página de Kino (relación de referencia, no cambia la ubicación de la tarea)', {
        pageId: z.string().uuid().describe('UUID de la página'),
        taskId: z.string().uuid().describe('UUID de la tarea a vincular'),
    }, async ({ pageId, taskId }) => {
        await kinoFetch(`/api/pages/${pageId}/tasks`, {
            method: 'POST',
            body: JSON.stringify({ taskId }),
        });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, pageId, taskId }) }] };
    });
    server.tool('unlink_task_from_page', 'Desvincula una tarea de una página de Kino (no elimina la tarea)', {
        pageId: z.string().uuid().describe('UUID de la página'),
        taskId: z.string().uuid().describe('UUID de la tarea a desvincular'),
    }, async ({ pageId, taskId }) => {
        await kinoFetch(`/api/pages/${pageId}/tasks/${taskId}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, pageId, taskId }) }] };
    });
}
