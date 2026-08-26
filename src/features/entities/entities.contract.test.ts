import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/shared/utils/error';
import { OWNER } from '@/shared/lib/scopes';

/**
 * El contrato de entidades por su URL. Cada caso fija el status y el body que
 * la ruta devolvía antes de entrar al contrato: si alguno cambia, esto se pone
 * rojo.
 */

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));
vi.mock('@/shared/db', () => ({ db: {} }));

const service = vi.hoisted(() => ({
  listEntities: vi.fn(),
  getEntityById: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
  createRelation: vi.fn(),
  deleteRelation: vi.fn(),
  getMentionedEntities: vi.fn(),
  getUniverseGraph: vi.fn(),
}));
vi.mock('./entities.service', () => service);

const { callApi } = await import('@/shared/api/testing');

const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';
const SYSTEM_ID = '5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const ENTITY_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';
const RELATION_ID = '2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b';

beforeEach(() => {
  vi.clearAllMocks();
  getAuthContext.mockResolvedValue({ userId: USER_ID, scopes: OWNER });
});

describe('entities · auth', () => {
  it('ninguna operación contesta sin credencial, ni llama al servicio', async () => {
    getAuthContext.mockResolvedValue(null);

    const responses = await Promise.all([
      callApi('GET', `/systems/${SYSTEM_ID}/entities`),
      callApi('POST', `/systems/${SYSTEM_ID}/entities`, {}),
      callApi('GET', `/systems/${SYSTEM_ID}/graph`),
      callApi('GET', `/entities/${ENTITY_ID}`),
      callApi('PATCH', `/entities/${ENTITY_ID}`, {}),
      callApi('DELETE', `/entities/${ENTITY_ID}`),
      callApi('POST', `/entities/${ENTITY_ID}/relations`, {}),
      callApi('GET', `/pages/${ENTITY_ID}/entities`),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    }
    expect(service.listEntities).not.toHaveBeenCalled();
    expect(service.createEntity).not.toHaveBeenCalled();
  });
});

describe('entities · lecturas', () => {
  it('la lista del sistema devuelve 200 y pasa systemId y userId', async () => {
    service.listEntities.mockResolvedValue([{ id: ENTITY_ID }]);

    const res = await callApi('GET', `/systems/${SYSTEM_ID}/entities`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: ENTITY_ID }]);
    expect(service.listEntities).toHaveBeenCalledWith(SYSTEM_ID, USER_ID);
  });

  it('el grafo devuelve 200', async () => {
    service.getUniverseGraph.mockResolvedValue({ nodes: [], edges: [] });

    const res = await callApi('GET', `/systems/${SYSTEM_ID}/graph`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nodes: [], edges: [] });
    expect(service.getUniverseGraph).toHaveBeenCalledWith(SYSTEM_ID, USER_ID);
  });

  it('una entidad que existe devuelve 200', async () => {
    service.getEntityById.mockResolvedValue({ id: ENTITY_ID, name: 'Elena' });

    const res = await callApi('GET', `/entities/${ENTITY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: ENTITY_ID, name: 'Elena' });
  });

  it('una que no existe devuelve 404 con el mensaje de siempre', async () => {
    service.getEntityById.mockResolvedValue(null);

    const res = await callApi('GET', `/entities/${ENTITY_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Entity not found' });
  });

  it('las menciones de una página devuelven 200', async () => {
    service.getMentionedEntities.mockResolvedValue([{ id: ENTITY_ID }]);

    const res = await callApi('GET', `/pages/${ENTITY_ID}/entities`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: ENTITY_ID }]);
  });
});

describe('entities · crear', () => {
  const validBody = { type: 'character', name: 'Elena' };

  it('devuelve 201 e inyecta el systemId de la URL', async () => {
    service.createEntity.mockResolvedValue({ id: ENTITY_ID, name: 'Elena' });

    const res = await callApi('POST', `/systems/${SYSTEM_ID}/entities`, validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: ENTITY_ID, name: 'Elena' });
    expect(service.createEntity).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ systemId: SYSTEM_ID, type: 'character', name: 'Elena' }),
    );
  });

  it('devuelve 400 con details cuando el body no valida', async () => {
    const res = await callApi('POST', `/systems/${SYSTEM_ID}/entities`, {
      type: 'no-existe',
      name: '',
    });

    expect(res.status).toBe(400);
    const payload = res.body as { code: string; message: string; details: { fieldErrors: unknown } };
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.message).toBe('Invalid input');
    expect(payload.details.fieldErrors).toBeDefined();
    expect(service.createEntity).not.toHaveBeenCalled();
  });

  it('el ForbiddenError del servicio sale como 403 con su mensaje', async () => {
    service.createEntity.mockRejectedValue(new ForbiddenError('El sistema no es tuyo'));

    const res = await callApi('POST', `/systems/${SYSTEM_ID}/entities`, validBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 'FORBIDDEN', message: 'El sistema no es tuyo' });
  });
});

describe('entities · actualizar', () => {
  it('devuelve 200 con la entidad actualizada', async () => {
    service.updateEntity.mockResolvedValue({ id: ENTITY_ID, name: 'Elena II' });

    const res = await callApi('PATCH', `/entities/${ENTITY_ID}`, { name: 'Elena II' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: ENTITY_ID, name: 'Elena II' });
    expect(service.updateEntity).toHaveBeenCalledWith(ENTITY_ID, USER_ID, { name: 'Elena II' });
  });

  it('devuelve 404 cuando la entidad no existe', async () => {
    service.updateEntity.mockResolvedValue(null);

    const res = await callApi('PATCH', `/entities/${ENTITY_ID}`, { name: 'x' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Entity not found' });
  });

  it('devuelve 400 cuando el body no valida', async () => {
    const res = await callApi('PATCH', `/entities/${ENTITY_ID}`, { name: '' });

    expect(res.status).toBe(400);
    expect(service.updateEntity).not.toHaveBeenCalled();
  });

  it('el ForbiddenError del servicio sale como 403', async () => {
    service.updateEntity.mockRejectedValue(new ForbiddenError('No es tuyo'));

    const res = await callApi('PATCH', `/entities/${ENTITY_ID}`, { name: 'x' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ code: 'FORBIDDEN', message: 'No es tuyo' });
  });
});

describe('entities · borrados', () => {
  it('borrar devuelve 204 sin body', async () => {
    service.deleteEntity.mockResolvedValue(true);

    const res = await callApi('DELETE', `/entities/${ENTITY_ID}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('borrar lo que no existe devuelve 404', async () => {
    service.deleteEntity.mockResolvedValue(false);

    const res = await callApi('DELETE', `/entities/${ENTITY_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Entity not found' });
  });

  it('borrar una relación usa el relationId, no el id de la entidad', async () => {
    service.deleteRelation.mockResolvedValue(true);

    const res = await callApi('DELETE', `/entities/${ENTITY_ID}/relations/${RELATION_ID}`);

    expect(res.status).toBe(204);
    expect(service.deleteRelation).toHaveBeenCalledWith(RELATION_ID, USER_ID);
  });

  it('una relación que no existe devuelve 404 con su propio mensaje', async () => {
    service.deleteRelation.mockResolvedValue(false);

    const res = await callApi('DELETE', `/entities/${ENTITY_ID}/relations/${RELATION_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ code: 'NOT_FOUND', message: 'Relation not found' });
  });

  it('el ForbiddenError al borrar una relación sale como 403', async () => {
    service.deleteRelation.mockRejectedValue(new ForbiddenError('Ajena'));

    const res = await callApi('DELETE', `/entities/${ENTITY_ID}/relations/${RELATION_ID}`);

    expect(res.status).toBe(403);
  });
});

describe('entities · relaciones', () => {
  it('crear una relación devuelve 201 y usa el id de la URL como origen', async () => {
    service.createRelation.mockResolvedValue({ id: RELATION_ID });

    const res = await callApi('POST', `/entities/${ENTITY_ID}/relations`, {
      toEntityId: SYSTEM_ID,
      label: 'hermana de',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: RELATION_ID });
    expect(service.createRelation).toHaveBeenCalledWith(ENTITY_ID, USER_ID, {
      toEntityId: SYSTEM_ID,
      label: 'hermana de',
    });
  });

  it('devuelve 400 cuando toEntityId no es un uuid', async () => {
    const res = await callApi('POST', `/entities/${ENTITY_ID}/relations`, {
      toEntityId: 'no-uuid',
    });

    expect(res.status).toBe(400);
    expect(service.createRelation).not.toHaveBeenCalled();
  });
});
