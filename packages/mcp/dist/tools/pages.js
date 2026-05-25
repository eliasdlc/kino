import { z } from 'zod';
import { kinoFetch } from '../client.js';
export function registerPageTools(server) {
    server.tool('list_pages', 'Lista las páginas (notas markdown) de un sistema en Kino', {
        systemId: z.string().uuid().describe('UUID del sistema'),
    }, async ({ systemId }) => {
        const pages = await kinoFetch(`/api/pages?systemId=${systemId}`);
        return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] };
    });
    server.tool('create_page', 'Crea una página markdown en un sistema de Kino', {
        title: z.string().max(500).optional().describe('Título de la página'),
        systemId: z.string().uuid().describe('UUID del sistema al que pertenece'),
        folderId: z.string().uuid().optional().describe('UUID de la carpeta (opcional)'),
    }, async (data) => {
        const page = await kinoFetch('/api/pages', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }] };
    });
}
