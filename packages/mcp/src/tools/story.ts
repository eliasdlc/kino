import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KinoFetch } from '../client.js';

/**
 * Tools de historia (PLAN-11 §10). La decisión de producto fue "MCP primero":
 * Kino no paga inferencia, expone el universo y el agente del usuario se vuelve
 * su editor de continuidad — "¿en qué capítulo presenté la daga?", "¿qué
 * inconsistencias de edad tiene Kael?".
 */

const entityType = z
  .enum(['character', 'location', 'object', 'concept', 'event', 'faction', 'other'])
  .describe(
    'Tipo de entidad: character (personaje), location (lugar), object (objeto), concept (concepto/lore), event (evento), faction (facción), other',
  );

const asText = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export function registerStoryTools(server: McpServer, kinoFetch: KinoFetch) {
  server.tool(
    'list_entities',
    'Lista el codex de un sistema de escritura: todos los personajes, lugares, objetos y conceptos del universo, con sus alias y resumen',
    {
      systemId: z.string().uuid().describe('UUID del sistema de escritura'),
    },
    async ({ systemId }) => asText(await kinoFetch(`/api/systems/${systemId}/entities`)),
  );

  server.tool(
    'get_entity',
    'Obtiene la ficha completa de una entidad del codex: atributos, relaciones y en qué capítulos aparece (con la primera aparición)',
    {
      entityId: z.string().uuid().describe('UUID de la entidad'),
    },
    async ({ entityId }) => asText(await kinoFetch(`/api/entities/${entityId}`)),
  );

  server.tool(
    'create_entity',
    'Crea una entidad en el codex de un sistema de escritura (personaje, lugar, objeto…)',
    {
      systemId: z.string().uuid().describe('UUID del sistema de escritura'),
      name: z.string().min(1).max(255).describe('Nombre de la entidad'),
      type: entityType,
      aliases: z
        .array(z.string().min(1).max(255))
        .max(50)
        .optional()
        .describe('Otros nombres por los que se la menciona en el texto'),
      summary: z
        .string()
        .max(1000)
        .optional()
        .describe('Una línea que la describa, para el popover del editor'),
      attributes: z
        .record(z.string(), z.string())
        .optional()
        .describe('Campos propios del tipo (edad, rol, origen…). Todo opcional'),
    },
    async ({ systemId, ...body }) =>
      asText(
        await kinoFetch(`/api/systems/${systemId}/entities`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      ),
  );

  server.tool(
    'update_entity',
    'Actualiza una entidad del codex: nombre, tipo, alias, resumen o atributos',
    {
      entityId: z.string().uuid().describe('UUID de la entidad'),
      name: z.string().min(1).max(255).optional().describe('Nuevo nombre'),
      type: entityType.optional(),
      aliases: z.array(z.string().min(1).max(255)).max(50).optional().describe('Lista completa de alias (reemplaza la anterior)'),
      summary: z.string().max(1000).nullable().optional().describe('Resumen de una línea (null para borrarlo)'),
      attributes: z
        .record(z.string(), z.string())
        .nullable()
        .optional()
        .describe('Atributos completos (reemplazan los anteriores)'),
    },
    async ({ entityId, ...body }) =>
      asText(
        await kinoFetch(`/api/entities/${entityId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        }),
      ),
  );

  server.tool(
    'link_entities',
    'Crea una relación entre dos entidades del codex ("padre de", "rival de", "vive en"). La dirección va de fromEntityId a toEntityId',
    {
      fromEntityId: z.string().uuid().describe('UUID de la entidad origen'),
      toEntityId: z.string().uuid().describe('UUID de la entidad destino'),
      label: z
        .string()
        .max(100)
        .optional()
        .describe('Etiqueta de la relación leída de origen a destino, p.ej. "rival de"'),
      notes: z.string().max(2000).optional().describe('Notas sobre la relación'),
    },
    async ({ fromEntityId, ...body }) =>
      asText(
        await kinoFetch(`/api/entities/${fromEntityId}/relations`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      ),
  );

  server.tool(
    'get_work_structure',
    'Estructura de una obra: sus capítulos en orden con palabras, si están terminados y qué entidades del codex aparecen en cada uno. La vista de conjunto para razonar sobre continuidad',
    {
      folderId: z.string().uuid().describe('UUID de la obra (folder del sistema de escritura)'),
    },
    async ({ folderId }) => asText(await kinoFetch(`/api/folders/${folderId}/structure`)),
  );

  server.tool(
    'search_story',
    'Busca una frase dentro del texto de las obras de un sistema y devuelve los capítulos con fragmentos alrededor de cada coincidencia',
    {
      systemId: z.string().uuid().describe('UUID del sistema de escritura'),
      query: z.string().min(2).describe('Texto a buscar dentro de los manuscritos'),
    },
    async ({ systemId, query }) =>
      asText(
        await kinoFetch(
          `/api/systems/${systemId}/story-search?q=${encodeURIComponent(query)}`,
        ),
      ),
  );
}
