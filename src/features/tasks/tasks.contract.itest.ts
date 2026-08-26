import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';
import { apiHandler } from '@/shared/api/handler';
import { generateApiKey } from '@/features/api-keys/api-keys.service';
import { createSystem } from '@/features/systems/systems.service';

/**
 * El contrato de `tasks` de punta a punta: una petición HTTP de verdad, con una
 * credencial de verdad, contra una base de verdad.
 *
 * Los tests de unidad mockean `@/shared/db` y comprueban el borde de permisos;
 * lo que no pueden contestar es si la ruta existe donde el contrato dice, si el
 * status es el que era y si lo que sale tiene la forma que declara. Eso sólo lo
 * sabe el handler entero.
 */

let actors: Actors;
let token: string;
let systemId: string;

beforeEach(async () => {
  actors = await resetAndSeedActors();
  systemId = (await createSystem(actors.alice, { name: 'Tesis', color: 'blue', icon: 'folder' }))!.id;
  token = (await generateApiKey(actors.alice, 'contrato')).token;
});

/** Una petición como la haría un cliente cualquiera contra `/api`. */
async function call(method: string, path: string, body?: unknown) {
  const request = new NextRequest(`http://localhost/api${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const { matched, response } = await apiHandler.handle(request, {
    prefix: '/api',
    context: { request },
  });

  expect(matched).toBe(true);
  const text = await response!.text();
  return { status: response!.status, body: text.length > 0 ? JSON.parse(text) : undefined };
}

const createTask = (title: string, extra: Record<string, unknown> = {}) =>
  call('POST', '/tasks', { systemId, title, ...extra });

describe('contrato · tasks de punta a punta', () => {
  it('crear devuelve 201 y la tarea con las fechas ya en texto', async () => {
    const { status, body } = await createTask('Marco teórico');

    expect(status).toBe(201);
    expect(body).toMatchObject({ title: 'Marco teórico', systemId, status: 'backlog' });
    // Lo que el tipo de transporte promete: un `Date` de la fila no llega nunca
    // como objeto, y ahora el contrato lo dice en vez de que el cliente lo asuma.
    expect(typeof body.createdAt).toBe('string');
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
  });

  it('el ciclo entero de una tarea pasa por las rutas de siempre', async () => {
    const { body: created } = await createTask('Defensa');

    await expect(call('GET', `/tasks/${created.id}`)).resolves.toMatchObject({
      status: 200,
      body: { id: created.id, title: 'Defensa' },
    });

    await expect(call('PATCH', `/tasks/${created.id}`, { title: 'Defensa final' })).resolves.toMatchObject({
      status: 200,
      body: { title: 'Defensa final' },
    });

    await expect(call('POST', `/tasks/${created.id}/toggle`)).resolves.toMatchObject({
      status: 200,
      body: { status: 'done' },
    });

    const removed = await call('DELETE', `/tasks/${created.id}`);
    expect(removed.status).toBe(204);
    expect(removed.body).toBeUndefined();

    await expect(call('GET', `/tasks/${created.id}`)).resolves.toMatchObject({ status: 404 });
  });

  it('la lista sólo trae lo del sistema pedido', async () => {
    await createTask('De este sistema');
    const otro = (await createSystem(actors.alice, { name: 'Otro', color: 'red', icon: 'folder' }))!;
    await call('POST', '/tasks', { systemId: otro.id, title: 'Del otro' });

    const { status, body } = await call('GET', `/systems/${systemId}/tasks`);

    expect(status).toBe(200);
    expect(body.map((t: { title: string }) => t.title)).toEqual(['De este sistema']);
  });

  it('un id que no es de nadie contesta 404 con el código de siempre', async () => {
    const { status, body } = await call('GET', '/tasks/11111111-1111-4111-8111-111111111111');

    expect(status).toBe(404);
    expect(body).toMatchObject({ code: 'NOT_FOUND' });
  });

  // 400 y 422 dicen cosas distintas y los dos son contrato: "no te entiendo"
  // contra "te entiendo y no".
  it('un body que no pasa el schema contesta 400 con el detalle del campo', async () => {
    const { status, body } = await call('POST', '/tasks', { systemId, title: '' });

    expect(status).toBe(400);
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Invalid input' });
    expect(body.details.fieldErrors.title).toBeTruthy();
  });

  it('una regla de dominio rota contesta 422', async () => {
    const { body: created } = await createTask('Con carpeta ajena');

    const { status, body } = await call('PATCH', `/tasks/${created.id}`, {
      folderId: '11111111-1111-4111-8111-111111111111',
    });

    expect(status).toBe(422);
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('una tarea de B no se lee con la credencial de A', async () => {
    const mine = await createTask('Mía');

    token = (await generateApiKey(actors.bob, 'contrato')).token;

    await expect(call('GET', `/tasks/${mine.body.id}`)).resolves.toMatchObject({ status: 404 });
  });
});
