import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { KinoFetch } from '../client.js';
import { registerLearningTools } from './learning.js';
import { htmlToMarkdown } from '../utils/markdown.js';

/**
 * Estas tools valen por la secuencia, no por la llamada: leen la página, la
 * reescriben y la guardan contra una versión. Lo que puede romperse es el orden
 * y lo que se manda, así que la API se simula con **sus mismas reglas** —guarda
 * HTML, mueve `updatedAt` en cada escritura y responde 409 a una versión vieja—
 * y lo que se comprueba es lo que acaba escrito.
 *
 * Es lo que un mock por llamada no diría: que el documento final tiene el estado
 * nuevo y el registro viejo a la vez.
 */

interface StoredPage {
  id: string;
  title: string | null;
  content: string | null;
  updatedAt: string;
}

function fakeKino() {
  const pages = new Map<string, StoredPage>();
  const notes: unknown[] = [];
  let clock = Date.parse('2026-08-28T04:00:00.000Z');
  const tick = () => new Date((clock += 1000)).toISOString();

  const kinoFetch: KinoFetch = async <T,>(path: string, options: RequestInit = {}) => {
    const method = options.method ?? 'GET';
    const body = options.body ? (JSON.parse(String(options.body)) as Record<string, string>) : {};
    const pageId = /^\/api\/pages\/([^/]+)/.exec(path)?.[1];

    if (path === '/api/pages' && method === 'POST') {
      const page: StoredPage = {
        id: randomUUID(),
        title: body.title ?? null,
        content: body.content ?? null,
        updatedAt: tick(),
      };
      pages.set(page.id, page);
      return page as T;
    }

    if (pageId && path.endsWith('/sticky-notes') && method === 'POST') {
      const note = { id: `note-${notes.length + 1}`, ...body };
      notes.push(note);
      return note as T;
    }

    const page = pageId ? pages.get(pageId) : undefined;
    if (!page) throw new Error(`Kino: server error 404 on ${path}`);

    if (method === 'GET') return page as T;

    if (method === 'PATCH') {
      if (body.expectedUpdatedAt && body.expectedUpdatedAt !== page.updatedAt) {
        throw new Error(`Kino: server error 409 on ${path} — la página cambió después de leerla`);
      }
      page.content = body.content ?? page.content;
      page.updatedAt = tick();
      return page as T;
    }

    throw new Error(`ruta no simulada: ${method} ${path}`);
  };

  return { kinoFetch, pages, notes };
}

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

let api: ReturnType<typeof fakeKino>;
let tools: Map<string, Handler>;

const call = async (name: string, args: Record<string, unknown>) =>
  JSON.parse((await tools.get(name)!(args)).content[0]!.text) as Record<string, string> &
    Record<string, never>;

const markdownDe = (pageId: string) => htmlToMarkdown(api.pages.get(pageId)!.content);

const paso = {
  currentNodeId: 'derivadas.cadena',
  lastUnderstood: 'La derivada es una pendiente',
  nextAction: 'Derivar sin(3x)',
  suggestedMinutes: 20,
};

async function nuevaSesion() {
  return call('create_learning_session', {
    systemId: 'sys-1',
    topic: 'Cálculo I',
    now: 'Regla de la cadena',
    why: 'Sale en el examen',
    ...paso,
  });
}

beforeEach(() => {
  api = fakeKino();
  tools = new Map();
  const server = {
    tool: (name: string, _description: string, _shape: unknown, handler: Handler) => {
      tools.set(name, handler);
    },
  } as unknown as McpServer;
  registerLearningTools(server, api.kinoFetch);
});

describe('sesiones de aprendizaje', () => {
  it('registra las cinco tools', () => {
    expect([...tools.keys()]).toEqual([
      'create_learning_session',
      'get_learning_session',
      'save_learning_checkpoint',
      'append_learning_interaction',
      'park_learning_thought',
    ]);
  });

  it('se crea, se lee y se reanuda por donde iba', async () => {
    const creada = await nuevaSesion();
    const leida = await call('get_learning_session', { pageId: creada.pageId });

    expect(leida.contentFormat).toBe('markdown');
    expect(leida.content).toContain('## Ahora');
    expect(leida.checkpoint).toMatchObject(paso);
    expect(leida.resume).toMatchObject({ nextAction: 'Derivar sin(3x)', suggestedMinutes: 20 });
    // La versión que devuelve la lectura es la que hay que guardar después.
    expect(leida.updatedAt).toBe(creada.updatedAt);
  });

  it('guardar el paso siguiente conserva el registro y el id de la sesión', async () => {
    const creada = await nuevaSesion();
    const conRegistro = await call('append_learning_interaction', {
      pageId: creada.pageId,
      expectedUpdatedAt: creada.updatedAt,
      kind: 'probe',
      content: 'Confundió producto con cadena',
    });

    const guardada = await call('save_learning_checkpoint', {
      pageId: creada.pageId,
      expectedUpdatedAt: conRegistro.updatedAt,
      now: 'Regla del producto',
      why: 'Es la que confundía',
      ...paso,
      currentNodeId: 'derivadas.producto',
      nextAction: 'Comparar las dos en un ejemplo',
    });

    const documento = markdownDe(creada.pageId)!;
    expect(documento).toContain('Confundió producto con cadena');
    expect(documento).toContain('Comparar las dos en un ejemplo');
    expect(documento).toContain('Regla del producto');
    // El id de sesión sobrevive a los guardados: es de la sesión, no del paso.
    expect(guardada.checkpoint).toMatchObject({
      sessionId: (creada.checkpoint as unknown as { sessionId: string }).sessionId,
      currentNodeId: 'derivadas.producto',
    });
  });

  it('una escritura con la versión vieja no pisa nada', async () => {
    const creada = await nuevaSesion();
    const versionVieja = creada.updatedAt;
    await call('append_learning_interaction', {
      pageId: creada.pageId,
      expectedUpdatedAt: versionVieja,
      kind: 'note',
      content: 'Primera, la que se queda',
    });

    await expect(
      call('save_learning_checkpoint', {
        pageId: creada.pageId,
        expectedUpdatedAt: versionVieja,
        now: 'Otra cosa',
        why: 'Otra razón',
        ...paso,
      }),
    ).rejects.toThrow(/409/);

    expect(markdownDe(creada.pageId)).toContain('Primera, la que se queda');
  });

  it('aparcar una idea no toca la sesión y devuelve dónde ibas', async () => {
    const creada = await nuevaSesion();

    const aparcada = await call('park_learning_thought', {
      pageId: creada.pageId,
      thought: '¿Esto sirve para la física?',
    });

    expect(api.notes).toHaveLength(1);
    expect(aparcada.resume).toMatchObject({ nextAction: 'Derivar sin(3x)' });
    // La página no se reescribe: su versión sigue siendo la de la creación.
    expect(api.pages.get(creada.pageId)!.updatedAt).toBe(creada.updatedAt);
  });

  it('una página que no es una sesión lo dice claro', async () => {
    const sueltaId = randomUUID();
    api.pages.set(sueltaId, {
      id: sueltaId,
      title: 'Una nota',
      content: '<p>texto cualquiera</p>',
      updatedAt: '2026-08-28T04:00:00.000Z',
    });

    await expect(call('get_learning_session', { pageId: sueltaId })).rejects.toThrow(
      /sesión de aprendizaje/,
    );
  });
});
