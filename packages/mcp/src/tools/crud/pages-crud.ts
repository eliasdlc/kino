import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../../client.js';
import { markdownToHtml } from '../../utils/markdown.js';

export function registerPageCrudTools(server: McpServer) {
  server.tool(
    'list_pages',
    'Lista las páginas (notas markdown) de un sistema en Kino',
    {
      systemId: z.string().uuid().describe('UUID del sistema'),
    },
    async ({ systemId }) => {
      const pages = await kinoFetch(`/api/pages?systemId=${systemId}`);
      return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] };
    },
  );

  server.tool(
    'create_page',
    'Crea una página markdown en un sistema de Kino',
    {
      title: z.string().max(500).optional().describe('Título de la página'),
      content: z.string().optional().describe('Contenido en markdown (se convierte a HTML al guardar para que el editor lo renderice correctamente)'),
      systemId: z.string().uuid().describe('UUID del sistema al que pertenece'),
      folderId: z.string().uuid().optional().describe('UUID de la carpeta (opcional)'),
    },
    async ({ content, ...rest }) => {
      const payload = content !== undefined
        ? { ...rest, content: markdownToHtml(content) }
        : rest;
      const page = await kinoFetch('/api/pages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }] };
    },
  );

  server.tool(
    'get_page',
    'Obtiene el contenido completo de una página (título, markdown, tasks vinculados)',
    {
      pageId: z.string().uuid().describe('UUID de la página'),
    },
    async ({ pageId }) => {
      const page = await kinoFetch(`/api/pages/${pageId}`);
      return { content: [{ type: 'text', text: JSON.stringify(page, null, 2) }] };
    },
  );

  server.tool(
    'update_page',
    'Actualiza una página de Kino: título, contenido markdown, carpeta o estado de pin',
    {
      pageId: z.string().uuid().describe('UUID de la página a actualizar'),
      title: z.string().max(500).nullable().optional().describe('Nuevo título (null para borrar)'),
      content: z.string().nullable().optional().describe('Contenido completo en markdown (null para borrar; se convierte a HTML al guardar para que el editor lo renderice correctamente)'),
      folderId: z.string().uuid().nullable().optional().describe('UUID de la carpeta destino (null para quitar de carpeta)'),
      isPinned: z.boolean().optional().describe('Fijar o desfijar la página'),
    },
    async ({ pageId, content, ...rest }) => {
      const payload = content !== undefined
        ? { ...rest, content: markdownToHtml(content) }
        : rest;
      const updated = await kinoFetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
    },
  );

  server.tool(
    'delete_page',
    'Elimina (soft-delete) una página de Kino',
    {
      pageId: z.string().uuid().describe('UUID de la página a eliminar'),
    },
    async ({ pageId }) => {
      await kinoFetch(`/api/pages/${pageId}`, { method: 'DELETE' });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, pageId }) }] };
    },
  );
}
