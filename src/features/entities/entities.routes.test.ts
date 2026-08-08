import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ForbiddenError } from '@/shared/utils/error';

/**
 * Contrato de las rutas de entidades tras migrarlas al wrapper `route`
 * (KIN-145). Cada caso fija el status y el body que el handler devolvía
 * ANTES de la migración: si el wrapper cambia alguno, esto se pone rojo.
 */

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));

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

const routes = await import('./entities.routes');

const USER_ID = '9c1d4f6a-2b3e-4a8c-9d5f-7e0a1b2c3d4e';
const SYSTEM_ID = '5a2b3c4d-6e7f-4a8b-9c0d-1e2f3a4b5c6d';
const ENTITY_ID = '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d0e';
const RELATION_ID = '2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b';

function get(url = 'http://localhost/api/test') {
  return new NextRequest(url);
}

function send(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  });
}

const idParams = { params: Promise.resolve({ id: ENTITY_ID }) };
const systemParams = { params: Promise.resolve({ id: SYSTEM_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthContext.mockResolvedValue({ userId: USER_ID });
});

describe('entities.routes · auth', () => {
  it('cada handler devuelve 401 sin auth, sin llamar al servicio', async () => {
    getAuthContext.mockResolvedValue(null);

    const responses = await Promise.all([
      routes.getSystemEntities(get(), systemParams),
      routes.createSystemEntity(send('POST', {}), systemParams),
      routes.getSystemGraph(get(), systemParams),
      routes.getEntity(get(), idParams),
      routes.patchEntity(send('PATCH', {}), idParams),
      routes.removeEntity(send('DELETE'), idParams),
      routes.createEntityRelation(send('POST', {}), idParams),
      routes.getPageEntities(get(), idParams),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      });
    }
    expect(service.listEntities).not.toHaveBeenCalled();
    expect(service.createEntity).not.toHaveBeenCalled();
  });
});

describe('entities.routes · lecturas', () => {
  it('getSystemEntities devuelve 200 con la lista y pasa systemId y userId', async () => {
    service.listEntities.mockResolvedValue([{ id: ENTITY_ID }]);

    const res = await routes.getSystemEntities(get(), systemParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: ENTITY_ID }]);
    expect(service.listEntities).toHaveBeenCalledWith(SYSTEM_ID, USER_ID);
  });

  it('getSystemGraph devuelve 200 con el grafo', async () => {
    service.getUniverseGraph.mockResolvedValue({ nodes: [], edges: [] });

    const res = await routes.getSystemGraph(get(), systemParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ nodes: [], edges: [] });
    expect(service.getUniverseGraph).toHaveBeenCalledWith(SYSTEM_ID, USER_ID);
  });

  it('getEntity devuelve 200 cuando existe', async () => {
    service.getEntityById.mockResolvedValue({ id: ENTITY_ID, name: 'Elena' });

    const res = await routes.getEntity(get(), idParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: ENTITY_ID, name: 'Elena' });
  });

  it('getEntity devuelve 404 con el mensaje de siempre cuando no existe', async () => {
    service.getEntityById.mockResolvedValue(null);

    const res = await routes.getEntity(get(), idParams);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Entity not found',
    });
  });

  it('getPageEntities devuelve 200 con las menciones', async () => {
    service.getMentionedEntities.mockResolvedValue([{ id: ENTITY_ID }]);

    const res = await routes.getPageEntities(get(), idParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([{ id: ENTITY_ID }]);
  });
});

describe('entities.routes · createSystemEntity', () => {
  const validBody = { type: 'character', name: 'Elena' };

  it('devuelve 201 e inyecta el systemId de la URL en el body validado', async () => {
    service.createEntity.mockResolvedValue({ id: ENTITY_ID, name: 'Elena' });

    const res = await routes.createSystemEntity(send('POST', validBody), systemParams);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: ENTITY_ID, name: 'Elena' });
    expect(service.createEntity).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ systemId: SYSTEM_ID, type: 'character', name: 'Elena' }),
    );
  });

  it('devuelve 400 con details cuando el body no valida', async () => {
    const res = await routes.createSystemEntity(
      send('POST', { type: 'no-existe', name: '' }),
      systemParams,
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.message).toBe('Invalid input');
    expect(payload.details.fieldErrors).toBeDefined();
    expect(service.createEntity).not.toHaveBeenCalled();
  });

  it('mapea el ForbiddenError del servicio a 403 conservando el mensaje', async () => {
    service.createEntity.mockRejectedValue(new ForbiddenError('El sistema no es tuyo'));

    const res = await routes.createSystemEntity(send('POST', validBody), systemParams);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      code: 'FORBIDDEN',
      message: 'El sistema no es tuyo',
    });
  });
});

describe('entities.routes · patchEntity', () => {
  it('devuelve 200 con la entidad actualizada', async () => {
    service.updateEntity.mockResolvedValue({ id: ENTITY_ID, name: 'Elena II' });

    const res = await routes.patchEntity(send('PATCH', { name: 'Elena II' }), idParams);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: ENTITY_ID, name: 'Elena II' });
    expect(service.updateEntity).toHaveBeenCalledWith(ENTITY_ID, USER_ID, { name: 'Elena II' });
  });

  it('devuelve 404 cuando la entidad no existe', async () => {
    service.updateEntity.mockResolvedValue(null);

    const res = await routes.patchEntity(send('PATCH', { name: 'x' }), idParams);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Entity not found',
    });
  });

  it('devuelve 400 cuando el body no valida', async () => {
    const res = await routes.patchEntity(send('PATCH', { name: '' }), idParams);

    expect(res.status).toBe(400);
    expect(service.updateEntity).not.toHaveBeenCalled();
  });

  it('mapea el ForbiddenError del servicio a 403', async () => {
    service.updateEntity.mockRejectedValue(new ForbiddenError('No es tuyo'));

    const res = await routes.patchEntity(send('PATCH', { name: 'x' }), idParams);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ code: 'FORBIDDEN', message: 'No es tuyo' });
  });
});

describe('entities.routes · borrados', () => {
  it('removeEntity devuelve 204 sin body', async () => {
    service.deleteEntity.mockResolvedValue(true);

    const res = await routes.removeEntity(send('DELETE'), idParams);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('removeEntity devuelve 404 cuando no había nada que borrar', async () => {
    service.deleteEntity.mockResolvedValue(false);

    const res = await routes.removeEntity(send('DELETE'), idParams);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Entity not found',
    });
  });

  it('removeEntityRelation devuelve 204 y usa relationId, no id', async () => {
    service.deleteRelation.mockResolvedValue(true);

    const res = await routes.removeEntityRelation(send('DELETE'), {
      params: Promise.resolve({ id: ENTITY_ID, relationId: RELATION_ID }),
    });

    expect(res.status).toBe(204);
    expect(service.deleteRelation).toHaveBeenCalledWith(RELATION_ID, USER_ID);
  });

  it('removeEntityRelation devuelve 404 con su propio mensaje', async () => {
    service.deleteRelation.mockResolvedValue(false);

    const res = await routes.removeEntityRelation(send('DELETE'), {
      params: Promise.resolve({ id: ENTITY_ID, relationId: RELATION_ID }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Relation not found',
    });
  });

  it('removeEntityRelation mapea ForbiddenError a 403', async () => {
    service.deleteRelation.mockRejectedValue(new ForbiddenError('Ajena'));

    const res = await routes.removeEntityRelation(send('DELETE'), {
      params: Promise.resolve({ id: ENTITY_ID, relationId: RELATION_ID }),
    });

    expect(res.status).toBe(403);
  });
});

describe('entities.routes · createEntityRelation', () => {
  it('devuelve 201 y usa el id de la URL como origen', async () => {
    service.createRelation.mockResolvedValue({ id: RELATION_ID });

    const res = await routes.createEntityRelation(
      send('POST', { toEntityId: SYSTEM_ID, label: 'hermana de' }),
      idParams,
    );

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: RELATION_ID });
    expect(service.createRelation).toHaveBeenCalledWith(ENTITY_ID, USER_ID, {
      toEntityId: SYSTEM_ID,
      label: 'hermana de',
    });
  });

  it('devuelve 400 cuando toEntityId no es un uuid', async () => {
    const res = await routes.createEntityRelation(
      send('POST', { toEntityId: 'no-uuid' }),
      idParams,
    );

    expect(res.status).toBe(400);
    expect(service.createRelation).not.toHaveBeenCalled();
  });

  it('mapea ForbiddenError a 403', async () => {
    service.createRelation.mockRejectedValue(new ForbiddenError('Cruzada'));

    const res = await routes.createEntityRelation(
      send('POST', { toEntityId: SYSTEM_ID }),
      idParams,
    );

    expect(res.status).toBe(403);
  });
});

describe('entities.routes · errores no previstos', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('un fallo inesperado del servicio da 500 y queda logueado, no mudo', async () => {
    const boom = new Error('Neon caído');
    service.listEntities.mockRejectedValue(boom);

    const res = await routes.getSystemEntities(get(), systemParams);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(consoleError).toHaveBeenCalledWith('[route] unhandled error:', boom);
  });
});
