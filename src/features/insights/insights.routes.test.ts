import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Contrato HTTP de los endpoints que BE-11 (KIN-148) añadió para que los tools
 * `estimate_task` y `generate_subtasks` puedan ser adaptadores de una sola
 * llamada. Ambos se autentican con `getAuthContext`, así que son alcanzables
 * con un Bearer `sk-kino-` igual que por cookie de sesión.
 */

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));

const service = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  getTopPattern: vi.fn(),
  getEnergyDistribution: vi.fn(),
  getSuggestedTasks: vi.fn(),
  classifyTask: vi.fn(),
  estimateTaskAttributes: vi.fn(),
  buildDecompositionBrief: vi.fn(),
  getStaleSystems: vi.fn(),
}));
vi.mock('./insights.service', () => service);

const { postEstimateRoute, postDecomposeRoute } = await import('./insights.routes');

const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';
const TASK_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';

function post(url: string, body?: unknown, raw?: string) {
  return new NextRequest(url, {
    method: 'POST',
    body: raw ?? JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// El wrapper `route()` recibe el contexto de Next como segundo argumento.
// Estas rutas no tienen segmento dinámico, así que va vacío.
const NO_PARAMS = { params: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthContext.mockResolvedValue({ userId: USER_ID });
});

describe('POST /api/insights/estimate', () => {
  const url = 'http://localhost/api/insights/estimate';

  it('401 sin credencial válida', async () => {
    getAuthContext.mockResolvedValue(null);
    const res = await postEstimateRoute(post(url, { title: 'x' }), NO_PARAMS);
    expect(res.status).toBe(401);
    expect(service.estimateTaskAttributes).not.toHaveBeenCalled();
  });

  it('400 con JSON inválido', async () => {
    const res = await postEstimateRoute(post(url, undefined, '{no soy json'), NO_PARAMS);
    expect(res.status).toBe(400);
  });

  it('400 sin title', async () => {
    expect((await postEstimateRoute(post(url, { description: 'x' }), NO_PARAMS)).status).toBe(400);
  });

  it('400 con title en blanco', async () => {
    expect((await postEstimateRoute(post(url, { title: '   ' }), NO_PARAMS)).status).toBe(400);
  });

  it('devuelve la estimación del service', async () => {
    service.estimateTaskAttributes.mockReturnValue({
      energyLevel: 'high',
      estimatedTime: '01:30:00',
      reasoning: 'x',
    });
    const res = await postEstimateRoute(post(url, { title: 'Analizar datos', description: 'd' }), NO_PARAMS);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      energyLevel: 'high',
      estimatedTime: '01:30:00',
      reasoning: 'x',
    });
    expect(service.estimateTaskAttributes).toHaveBeenCalledWith('Analizar datos', 'd');
  });

  it('ignora una description que no sea string en vez de romperse', async () => {
    service.estimateTaskAttributes.mockReturnValue({});
    await postEstimateRoute(post(url, { title: 't', description: 42 }), NO_PARAMS);
    expect(service.estimateTaskAttributes).toHaveBeenCalledWith('t', undefined);
  });
});

describe('POST /api/insights/decompose', () => {
  const url = 'http://localhost/api/insights/decompose';

  it('401 sin credencial válida', async () => {
    getAuthContext.mockResolvedValue(null);
    const res = await postDecomposeRoute(post(url, { taskId: TASK_ID }), NO_PARAMS);
    expect(res.status).toBe(401);
    expect(service.buildDecompositionBrief).not.toHaveBeenCalled();
  });

  // Sin esta validación el id mal formado llegaría a Postgres y el cast fallido
  // saldría como 500, escondiendo un error del llamante detrás de uno del server.
  it('400 con un taskId que no es uuid, en vez del 500 del cast de Postgres', async () => {
    const res = await postDecomposeRoute(post(url, { taskId: 'no-soy-uuid' }), NO_PARAMS);
    expect(res.status).toBe(400);
    expect(service.buildDecompositionBrief).not.toHaveBeenCalled();
  });

  it('400 con count no numérico', async () => {
    expect((await postDecomposeRoute(post(url, { taskId: TASK_ID, count: 'tres' }), NO_PARAMS)).status).toBe(400);
  });

  it('404 cuando la tarea no existe o es de otro usuario', async () => {
    service.buildDecompositionBrief.mockResolvedValue(null);
    const res = await postDecomposeRoute(post(url, { taskId: TASK_ID }), NO_PARAMS);
    expect(res.status).toBe(404);
  });

  it('devuelve el brief completo en una sola llamada', async () => {
    const brief = { task: { id: TASK_ID }, count: 3, existingSubtasks: [], guidance: [], outputContract: {} };
    service.buildDecompositionBrief.mockResolvedValue(brief);

    const res = await postDecomposeRoute(post(url, { taskId: TASK_ID, count: 5 }), NO_PARAMS);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(brief);
    expect(service.buildDecompositionBrief).toHaveBeenCalledWith(USER_ID, TASK_ID, 5);
  });

  it('deja que el service aplique el default cuando no se pasa count', async () => {
    service.buildDecompositionBrief.mockResolvedValue({});
    await postDecomposeRoute(post(url, { taskId: TASK_ID }), NO_PARAMS);
    expect(service.buildDecompositionBrief).toHaveBeenCalledWith(USER_ID, TASK_ID, undefined);
  });

  it('500 si el service revienta, sin filtrar el error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service.buildDecompositionBrief.mockRejectedValue(new Error('db caída'));
    const res = await postDecomposeRoute(post(url, { taskId: TASK_ID }), NO_PARAMS);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
