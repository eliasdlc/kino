import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { kinoFetch } from '../../client.js';

export function registerSystemCrudTools(server: McpServer) {
  server.tool(
    'list_systems',
    'Lista todos los sistemas del usuario en Kino (proyectos, áreas, etc.)',
    {},
    async () => {
      const systems = await kinoFetch('/api/systems');
      return { content: [{ type: 'text', text: JSON.stringify(systems, null, 2) }] };
    },
  );

  server.tool(
    'create_system',
    'Crea un nuevo sistema (proyecto o área) en Kino',
    {
      name: z.string().min(1).max(100).describe('Nombre del sistema'),
      color: z
        .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'teal', 'black', 'white'])
        .optional()
        .describe('Color del sistema'),
      icon: z.string().optional().describe('Emoji o ícono para el sistema'),
      identityStatement: z.string().max(500).optional().describe('Propósito del sistema (ej: "Gestiono mis proyectos freelance")'),
      templateType: z
        .enum(['academic', 'professional', 'entrepreneurial', 'personal', 'custom'])
        .optional()
        .describe('Tipo de plantilla del sistema'),
      energyIdeal: z.enum(['high', 'medium', 'low']).optional().describe('Nivel de energía ideal para trabajar en este sistema'),
    },
    async (data) => {
      const system = await kinoFetch('/api/systems', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(system, null, 2) }] };
    },
  );

  server.tool(
    'update_system',
    'Actualiza propiedades de un sistema existente en Kino (nombre, color, ícono, propósito, etc.)',
    {
      systemId: z.string().uuid().describe('UUID del sistema a actualizar'),
      name: z.string().min(1).max(255).optional(),
      color: z
        .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray', 'teal', 'black', 'white'])
        .optional(),
      icon: z.string().max(50).optional(),
      identityStatement: z.string().max(500).optional().describe('Propósito del sistema'),
      templateType: z
        .enum(['academic', 'professional', 'entrepreneurial', 'personal', 'custom'])
        .optional(),
      energyIdeal: z.enum(['high', 'medium', 'low']).optional(),
      expectedFrequency: z.string().max(20).optional().describe('Frecuencia esperada de uso (ej: "diario", "semanal")'),
      triggerContext: z.string().max(255).optional().describe('Contexto o condición para trabajar en este sistema'),
    },
    async ({ systemId, ...data }) => {
      const system = await kinoFetch(`/api/systems/${systemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return { content: [{ type: 'text', text: JSON.stringify(system, null, 2) }] };
    },
  );

  server.tool(
    'delete_system',
    'Desactiva (soft-delete) un sistema en Kino. No puede eliminarse el Inbox.',
    {
      systemId: z.string().uuid().describe('UUID del sistema a eliminar'),
    },
    async ({ systemId }) => {
      await kinoFetch(`/api/systems/${systemId}`, { method: 'DELETE' });
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, systemId }) }] };
    },
  );
}
