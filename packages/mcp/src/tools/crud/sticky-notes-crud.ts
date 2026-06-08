import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KinoFetch } from '../../client.js';

const color = z
  .enum(['red', 'blue', 'pink', 'purple', 'green', 'orange', 'yellow', 'teal', 'gray', 'black', 'white'])
  .optional()
  .describe('Color de la nota');

export function registerStickyNoteCrudTools(server: McpServer, kinoFetch: KinoFetch) {
  server.tool(
    'list_sticky_notes',
    'Lista las notas adhesivas (sticky notes) de una carpeta o de una página en Kino. Debes indicar folderId O pageId.',
    {
      folderId: z.string().uuid().optional().describe('UUID de la carpeta'),
      pageId: z.string().uuid().optional().describe('UUID de la página'),
    },
    async ({ folderId, pageId }) => {
      if ((folderId && pageId) || (!folderId && !pageId)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Indica exactamente uno: folderId o pageId.' }) }],
        };
      }
      const path = folderId
        ? `/api/folders/${folderId}/sticky-notes`
        : `/api/pages/${pageId}/sticky-notes`;
      const notes = await kinoFetch(path);
      return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] };
    },
  );

  server.tool(
    'create_sticky_note',
    'Crea una nota adhesiva (sticky note) anclada a una carpeta o a una página en Kino. Debes indicar folderId O pageId.',
    {
      folderId: z.string().uuid().optional().describe('UUID de la carpeta donde anclar la nota'),
      pageId: z.string().uuid().optional().describe('UUID de la página donde anclar la nota'),
      title: z.string().max(200).optional().describe('Título de la nota'),
      content: z.string().max(500).optional().describe('Contenido de la nota'),
      color,
    },
    async ({ folderId, pageId, ...data }) => {
      if ((folderId && pageId) || (!folderId && !pageId)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Indica exactamente uno: folderId o pageId.' }) }],
        };
      }
      const path = folderId
        ? `/api/folders/${folderId}/sticky-notes`
        : `/api/pages/${pageId}/sticky-notes`;
      const note = await kinoFetch(path, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
    },
  );

  server.tool(
    'update_sticky_note',
    'Actualiza el título, contenido o color de una nota adhesiva en Kino',
    {
      noteId: z.string().uuid().describe('UUID de la nota a actualizar'),
      title: z.string().max(200).nullable().optional().describe('Nuevo título (null para borrar)'),
      content: z.string().max(500).nullable().optional().describe('Nuevo contenido (null para borrar)'),
      color,
    },
    async ({ noteId, ...data }) => {
      const note = await kinoFetch(`/api/sticky-notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
    },
  );

  server.tool(
    'delete_sticky_note',
    'Elimina una nota adhesiva de Kino',
    {
      noteId: z.string().uuid().describe('UUID de la nota a eliminar'),
    },
    async ({ noteId }) => {
      await kinoFetch(`/api/sticky-notes/${noteId}`, { method: 'DELETE' });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, noteId }) }] };
    },
  );
}
