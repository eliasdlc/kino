import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OWNER } from '@/shared/lib/scopes';

/**
 * Los dos endpoints que existen para que `estimate_task` y `generate_subtasks`
 * sean adaptadores de una sola llamada. Se autentican con `getAuthContext`, así
 * que son alcanzables con un Bearer `sk-kino-` igual que por cookie de sesión.
 */

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));
vi.mock('@/shared/db', () => ({ db: {} }));

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

const { callApi } = await import('@/shared/api/testing');

const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';
const TASK_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';

beforeEach(() => {
  vi.clearAllMocks();
  getAuthContext.mockResolvedValue({ userId: USER_ID, scopes: OWNER });
});

describe('POST /insights/estimate', () => {
  it('401 sin credencial válida', async () => {
    getAuthContext.mockResolvedValue(null);

    const res = await callApi('POST', '/insights/estimate', { title: 'x' });

    expect(res.status).toBe(401);
    expect(service.estimateTaskAttributes).not.toHaveBeenCalled();
  });

  it('400 con JSON inválido', async () => {
    const res = await callApi('POST', '/insights/estimate', undefined, '{no soy json');
    expect(res.status).toBe(400);
  });

  it('400 sin title', async () => {
    expect((await callApi('POST', '/insights/estimate', { description: 'x' })).status).toBe(400);
  });

  it('400 con title en blanco', async () => {
    expect((await callApi('POST', '/insights/estimate', { title: '   ' })).status).toBe(400);
  });

  it('devuelve la estimación del service', async () => {
    service.estimateTaskAttributes.mockReturnValue({
      energyLevel: 'high',
      estimatedTime: '01:30:00',
      reasoning: 'x',
    });

    const res = await callApi('POST', '/insights/estimate', {
      title: 'Analizar datos',
      description: 'd',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ energyLevel: 'high', estimatedTime: '01:30:00', reasoning: 'x' });
    expect(service.estimateTaskAttributes).toHaveBeenCalledWith('Analizar datos', 'd');
  });

  it('ignora una description que no sea string en vez de romperse', async () => {
    service.estimateTaskAttributes.mockReturnValue({});

    await callApi('POST', '/insights/estimate', { title: 't', description: 42 });

    expect(service.estimateTaskAttributes).toHaveBeenCalledWith('t', undefined);
  });

  // El body es el filtro de una lectura, no una mutación: exigir escritura
  // sería mentir sobre lo que hace la operación.
  it('un token de sólo lectura basta, aunque sea un POST', async () => {
    getAuthContext.mockResolvedValue({
      userId: USER_ID,
      scopes: { kind: 'oauth', granted: ['kino:read'] },
    });
    service.estimateTaskAttributes.mockReturnValue({});

    expect((await callApi('POST', '/insights/estimate', { title: 't' })).status).toBe(200);
  });
});

describe('POST /insights/decompose', () => {
  it('401 sin credencial válida', async () => {
    getAuthContext.mockResolvedValue(null);

    const res = await callApi('POST', '/insights/decompose', { taskId: TASK_ID });

    expect(res.status).toBe(401);
    expect(service.buildDecompositionBrief).not.toHaveBeenCalled();
  });

  // Sin esta validación el id mal formado llegaría a Postgres y el cast fallido
  // saldría como 500, escondiendo un error del llamante detrás de uno del server.
  it('400 con un taskId que no es uuid, en vez del 500 del cast de Postgres', async () => {
    const res = await callApi('POST', '/insights/decompose', { taskId: 'no-soy-uuid' });

    expect(res.status).toBe(400);
    expect(service.buildDecompositionBrief).not.toHaveBeenCalled();
  });

  it('400 con count no numérico', async () => {
    const res = await callApi('POST', '/insights/decompose', { taskId: TASK_ID, count: 'tres' });
    expect(res.status).toBe(400);
  });

  it('404 cuando la tarea no existe o es de otro usuario', async () => {
    service.buildDecompositionBrief.mockResolvedValue(null);

    expect((await callApi('POST', '/insights/decompose', { taskId: TASK_ID })).status).toBe(404);
  });

  it('devuelve el brief completo en una sola llamada', async () => {
    const brief = { task: { id: TASK_ID }, count: 3, existingSubtasks: [], guidance: [], outputContract: {} };
    service.buildDecompositionBrief.mockResolvedValue(brief);

    const res = await callApi('POST', '/insights/decompose', { taskId: TASK_ID, count: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(brief);
    expect(service.buildDecompositionBrief).toHaveBeenCalledWith(USER_ID, TASK_ID, 5);
  });

  it('deja que el service aplique el default cuando no se pasa count', async () => {
    service.buildDecompositionBrief.mockResolvedValue({});

    await callApi('POST', '/insights/decompose', { taskId: TASK_ID });

    expect(service.buildDecompositionBrief).toHaveBeenCalledWith(USER_ID, TASK_ID, undefined);
  });

  it('500 si el service revienta, sin filtrar el error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service.buildDecompositionBrief.mockRejectedValue(new Error('db caída'));

    const res = await callApi('POST', '/insights/decompose', { taskId: TASK_ID });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
