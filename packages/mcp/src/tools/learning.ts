import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { KinoFetch } from '../client.js';
import {
  parseLearningCheckpoint,
  renderLearningSessionDocument,
  updateLearningSessionDocument,
  type ResumeCheckpoint,
} from '../utils/learning-session.js';
import { markdownToHtml } from '../utils/markdown.js';
import {
  appendMarkdown,
  assertPageVersion,
  pageAsMarkdown,
  parseStoredPage,
} from '../utils/page-content.js';

const checkpointInputShape = {
  currentNodeId: z.string().min(1).describe('ID estable del nodo actual'),
  lastUnderstood: z.string().describe('Última idea que el alumno demostró comprender'),
  openQuestion: z.string().nullable().optional().describe('Duda abierta, o null si no hay una'),
  nextAction: z.string().min(1).describe('Una sola acción clara para continuar'),
  suggestedMinutes: z.number().int().min(1).max(90).describe('Duración sugerida del próximo bloque'),
};

const createdPageSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.string(),
}).passthrough();

function checkpointFromInput(
  sessionId: string,
  input: {
    currentNodeId: string;
    lastUnderstood: string;
    openQuestion?: string | null;
    nextAction: string;
    suggestedMinutes: number;
  },
): ResumeCheckpoint {
  return {
    schemaVersion: 1,
    sessionId,
    currentNodeId: input.currentNodeId,
    lastUnderstood: input.lastUnderstood,
    openQuestion: input.openQuestion ?? null,
    nextAction: input.nextAction,
    suggestedMinutes: input.suggestedMinutes,
    learnerStateUpdatedAt: new Date().toISOString(),
  };
}

export function registerLearningTools(server: McpServer, kinoFetch: KinoFetch) {
  server.tool(
    'create_learning_session',
    'Crea una sesión de aprendizaje reanudable en una página de Kino',
    {
      systemId: z.string().uuid().describe('UUID del sistema de Kino'),
      folderId: z.string().uuid().optional().describe('UUID de la carpeta opcional'),
      topic: z.string().min(1).max(500).describe('Tema de la sesión'),
      now: z.string().min(1).describe('Qué debe atender el alumno ahora'),
      why: z.string().min(1).describe('Por qué este paso importa'),
      ...checkpointInputShape,
    },
    async ({ systemId, folderId, topic, now, why, ...input }) => {
      const checkpoint = checkpointFromInput(randomUUID(), input);
      const markdown = renderLearningSessionDocument({ topic, now, why, checkpoint });
      const page = createdPageSchema.parse(await kinoFetch('/api/pages', {
        method: 'POST',
        body: JSON.stringify({
          systemId,
          folderId,
          title: `Aprendizaje: ${topic}`,
          content: markdownToHtml(markdown),
        }),
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ page, checkpoint, contentFormat: 'markdown' }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'get_learning_session',
    'Recupera una sesión de aprendizaje y su checkpoint listo para reanudar',
    {
      pageId: z.string().uuid().describe('UUID de la página de sesión'),
    },
    async ({ pageId }) => {
      const page = pageAsMarkdown(await kinoFetch(`/api/pages/${pageId}`));
      if (!page.content) throw new Error('The learning session page has no content.');
      const checkpoint = parseLearningCheckpoint(page.content);

      return {
        content: [{ type: 'text', text: JSON.stringify({ page, checkpoint }, null, 2) }],
      };
    },
  );

  server.tool(
    'save_learning_checkpoint',
    'Actualiza Ahora, Por qué, Después y el checkpoint sin pisar una edición más reciente',
    {
      pageId: z.string().uuid().describe('UUID de la página de sesión'),
      expectedUpdatedAt: z.iso.datetime({ offset: true }).describe('Versión updatedAt devuelta por get_learning_session'),
      now: z.string().min(1).describe('Qué debe atender el alumno ahora'),
      why: z.string().min(1).describe('Por qué este paso importa'),
      ...checkpointInputShape,
    },
    async ({ pageId, expectedUpdatedAt, now, why, ...input }) => {
      const stored = parseStoredPage(await kinoFetch(`/api/pages/${pageId}`));
      assertPageVersion(stored, expectedUpdatedAt);
      const page = pageAsMarkdown(stored);
      if (!page.content) throw new Error('The learning session page has no content.');

      const previous = parseLearningCheckpoint(page.content);
      const checkpoint = checkpointFromInput(previous.sessionId, input);
      const markdown = updateLearningSessionDocument(page.content, { now, why, checkpoint });
      const updated = pageAsMarkdown(await kinoFetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: markdownToHtml(markdown), expectedUpdatedAt }),
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ page: updated, checkpoint }, null, 2) }],
      };
    },
  );

  server.tool(
    'append_learning_interaction',
    'Registra una interacción de aprendizaje sin duplicarla si la página ya cambió',
    {
      pageId: z.string().uuid().describe('UUID de la página de sesión'),
      expectedUpdatedAt: z.iso.datetime({ offset: true }).describe('Versión updatedAt de la última lectura o escritura'),
      kind: z.enum(['probe', 'teach', 'check', 'note']).describe('Tipo de interacción'),
      content: z.string().min(1).describe('Evidencia o contenido en Markdown'),
      recordedAt: z.iso.datetime({ offset: true }).optional().describe('Timestamp de la interacción; usa ahora si se omite'),
    },
    async ({ pageId, expectedUpdatedAt, kind, content, recordedAt }) => {
      const stored = parseStoredPage(await kinoFetch(`/api/pages/${pageId}`));
      assertPageVersion(stored, expectedUpdatedAt);
      const page = pageAsMarkdown(stored);
      if (!page.content) throw new Error('The learning session page has no content.');
      parseLearningCheckpoint(page.content);

      const entry = `### ${kind} | ${recordedAt ?? new Date().toISOString()}\n\n${content.trim()}`;
      const markdown = appendMarkdown(page.content, entry);
      const updated = pageAsMarkdown(await kinoFetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: markdownToHtml(markdown), expectedUpdatedAt }),
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ page: updated }, null, 2) }],
      };
    },
  );

  server.tool(
    'park_learning_thought',
    'Guarda una distracción o idea en Kino y devuelve el mismo punto de aprendizaje para continuar',
    {
      pageId: z.string().uuid().describe('UUID de la página de sesión'),
      thought: z.string().min(1).max(500).describe('Idea que no debe perderse ni interrumpir el paso actual'),
      title: z.string().max(200).optional().describe('Título breve opcional'),
    },
    async ({ pageId, thought, title }) => {
      const page = pageAsMarkdown(await kinoFetch(`/api/pages/${pageId}`));
      if (!page.content) throw new Error('The learning session page has no content.');
      const checkpoint = parseLearningCheckpoint(page.content);
      const note = await kinoFetch(`/api/pages/${pageId}/sticky-notes`, {
        method: 'POST',
        body: JSON.stringify({
          title: title ?? 'Pensamiento estacionado',
          content: thought,
          color: 'gray',
        }),
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            note,
            resume: {
              pageId,
              currentNodeId: checkpoint.currentNodeId,
              nextAction: checkpoint.nextAction,
            },
          }, null, 2),
        }],
      };
    },
  );
}
