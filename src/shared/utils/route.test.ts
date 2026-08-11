import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/utils/error';

const getAuthContext = vi.hoisted(() => vi.fn());
vi.mock('@/shared/utils/auth-context', () => ({ getAuthContext }));

const { route } = await import('@/shared/utils/route');

const USER_ID = '11111111-1111-1111-1111-111111111111';

/** Lo que Next pasa a una ruta no dinámica: el objeto existe, los params van vacíos. */
const EMPTY_CTX = { params: Promise.resolve({}) };

function req(body?: unknown, url = 'http://localhost/api/test') {
  return new NextRequest(url, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined
      ? {}
      : {
          body: typeof body === 'string' ? body : JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
  });
}

beforeEach(() => {
  getAuthContext.mockReset();
  getAuthContext.mockResolvedValue({ userId: USER_ID });
});

describe('route() · auth', () => {
  it('devuelve 401 con el shape canónico cuando no hay contexto de auth', async () => {
    getAuthContext.mockResolvedValue(null);
    const handler = vi.fn();

    const res = await route()({}, handler)(req(), EMPTY_CTX);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('pasa el userId resuelto al handler', async () => {
    const handler = vi.fn(({ userId }) => NextResponse.json({ userId }));

    const res = await route()({}, handler)(req(), EMPTY_CTX);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ userId: USER_ID });
  });
});

describe('route() · validación de body', () => {
  const schema = z.object({ name: z.string().min(1), count: z.number() });

  it('devuelve 400 con details cuando el body no valida', async () => {
    const handler = vi.fn();

    const res = await route()({ body: schema }, handler)(req({ name: '', count: 'x' }), EMPTY_CTX);

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.message).toBe('Invalid input');
    expect(payload.details).toBeDefined();
    expect(payload.details.fieldErrors).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('devuelve 400 cuando el JSON está malformado, en vez de un 500 mudo', async () => {
    const handler = vi.fn();

    const res = await route()({ body: schema }, handler)(req('{ roto'), EMPTY_CTX);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid JSON body',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('entrega el body ya parseado y tipado al handler', async () => {
    const handler = vi.fn(({ body }) => NextResponse.json(body));

    const res = await route()({ body: schema }, handler)(req({ name: 'kino', count: 2 }), EMPTY_CTX);

    await expect(res.json()).resolves.toEqual({ name: 'kino', count: 2 });
  });

  it('no lee el body cuando no se declaró schema', async () => {
    const handler = vi.fn(({ body }) => NextResponse.json({ body: body ?? null }));

    const res = await route()({}, handler)(req({ ignorado: true }), EMPTY_CTX);

    await expect(res.json()).resolves.toEqual({ body: null });
  });

  it('aplica prepareBody antes de validar, para inyectar valores de la URL', async () => {
    const withSystem = z.object({ name: z.string(), systemId: z.string() });
    const handler = vi.fn(({ body }) => NextResponse.json(body));

    const wrapped = route<{ id: string }>()(
      {
        body: withSystem,
        prepareBody: (raw, params) => ({ ...(raw as object), systemId: params.id }),
      },
      handler,
    );
    const res = await wrapped(req({ name: 'Elena' }), {
      params: Promise.resolve({ id: 'sys-1' }),
    });

    await expect(res.json()).resolves.toEqual({ name: 'Elena', systemId: 'sys-1' });
  });
});

describe('route() · validación de query', () => {
  const schema = z.object({ taskId: z.string().uuid() });

  it('devuelve 400 con details cuando la query no valida', async () => {
    const res = await route()({ query: schema }, vi.fn())(
      req(undefined, 'http://localhost/api/test?taskId=no-es-uuid'),
      EMPTY_CTX,
    );

    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.details.fieldErrors.taskId).toBeDefined();
  });

  it('entrega la query parseada al handler', async () => {
    const uuid = '3f8b1a2c-5d4e-4b7a-9c2f-1e6d8a0b3c5d';
    const handler = vi.fn(({ query }) => NextResponse.json(query));

    const res = await route()({ query: schema }, handler)(
      req(undefined, `http://localhost/api/test?taskId=${uuid}`),
      EMPTY_CTX,
    );

    await expect(res.json()).resolves.toEqual({ taskId: uuid });
  });
});

describe('route() · params', () => {
  it('resuelve la promesa de params antes de llamar al handler', async () => {
    const handler = vi.fn(({ params }) => NextResponse.json(params));

    const res = await route()({}, handler)(req(), {
      params: Promise.resolve({ id: 'abc', relationId: 'rel-9' }),
    });

    await expect(res.json()).resolves.toEqual({ id: 'abc', relationId: 'rel-9' });
  });

  it('entrega un objeto vacío en rutas sin params', async () => {
    const handler = vi.fn(({ params }) => NextResponse.json(params));

    const res = await route()({}, handler)(req(), EMPTY_CTX);

    await expect(res.json()).resolves.toEqual({});
  });
});

describe('route() · mapeo de errores', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('mapea NotFoundError a 404', async () => {
    const res = await route()({}, () => {
      throw new NotFoundError('Entity not found');
    })(req(), EMPTY_CTX);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'NOT_FOUND',
      message: 'Entity not found',
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('mapea ForbiddenError a 403', async () => {
    const res = await route()({}, () => {
      throw new ForbiddenError('No es tuyo');
    })(req(), EMPTY_CTX);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ code: 'FORBIDDEN', message: 'No es tuyo' });
  });

  it('mapea ValidationError a 400', async () => {
    const res = await route()({}, () => {
      throw new ValidationError('Rango inválido');
    })(req(), EMPTY_CTX);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Rango inválido',
    });
  });

  it('mapea un Error genérico a 500 y lo loguea en vez de tragárselo', async () => {
    const boom = new Error('conexión caída');

    const res = await route()({}, () => {
      throw boom;
    })(req(), EMPTY_CTX);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(consoleError).toHaveBeenCalledWith('[route] unhandled error:', boom);
  });

  it('también captura errores de un handler asíncrono', async () => {
    const res = await route()({}, async () => {
      await Promise.resolve();
      throw new NotFoundError('tarde');
    })(req(), EMPTY_CTX);

    expect(res.status).toBe(404);
  });
});

describe('route() · camino feliz', () => {
  it('respeta el status que devuelve el handler', async () => {
    const res = await route()({}, () => NextResponse.json({ ok: true }, { status: 201 }))(req(), EMPTY_CTX);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('respeta un 204 sin body', async () => {
    const res = await route()({}, () => new NextResponse(null, { status: 204 }))(req(), EMPTY_CTX);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('expone el request crudo para rutas que lo necesitan', async () => {
    const handler = vi.fn(({ request }) => NextResponse.json({ url: request.url }));

    const res = await route()({}, handler)(req(undefined, 'http://localhost/api/uploads?x=1'), EMPTY_CTX);

    await expect(res.json()).resolves.toEqual({ url: 'http://localhost/api/uploads?x=1' });
  });
});
