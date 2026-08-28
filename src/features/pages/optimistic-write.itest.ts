import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/shared/db';
import { pages } from '@/shared/db/schema';
import { eq } from 'drizzle-orm';
import { resetAndSeedActors, type Actors } from '@/shared/db/testing/harness';
import { createSystem } from '@/features/systems/systems.service';
import { createPage, updatePage } from '@/features/pages/pages.service';
import { ConflictError } from '@/shared/utils/error';
import { apiHandler } from '@/shared/api/handler';
import { generateApiKey } from '@/features/api-keys/api-keys.service';

/**
 * `expectedUpdatedAt` sólo vale lo que valga contra Postgres, y por eso esto no
 * es un test de unidad: las dos puntas guardan la fecha con precisión distinta.
 * En la base `updated_at` nace de `defaultNow()` y lleva microsegundos; al
 * cliente viaja como ISO, que se queda en el milisegundo. Con un mock las dos
 * son el mismo objeto Date y el desajuste no aparece nunca.
 *
 * La versión rota que este test tiene que cazar es comparar en crudo: una página
 * recién creada dejaría de poder guardarse contra su propia versión.
 */

let actors: Actors;
let systemId: string;

beforeEach(async () => {
  actors = await resetAndSeedActors();
  systemId = (await createSystem(actors.alice, { name: 'Cuadernos', color: 'blue', icon: 'folder' }))!.id;
});

const nuevaPagina = () =>
  createPage(actors.alice, { systemId, title: 'Sesión', content: '<p>uno</p>' });

const contenidoDe = async (pageId: string) =>
  (await db.select({ content: pages.content }).from(pages).where(eq(pages.id, pageId)))[0]?.content;

describe('escritura optimista de páginas', () => {
  it('acepta la versión que la propia base acaba de escribir, microsegundos incluidos', async () => {
    const page = await nuevaPagina();

    const updated = await updatePage(page.id, actors.alice, {
      content: '<p>dos</p>',
      expectedUpdatedAt: page.updatedAt.toISOString(),
    });

    expect(updated?.content).toBe('<p>dos</p>');
  });

  it('encadena escrituras usando la versión que devolvió la anterior', async () => {
    const page = await nuevaPagina();
    const primera = await updatePage(page.id, actors.alice, {
      content: '<p>dos</p>',
      expectedUpdatedAt: page.updatedAt.toISOString(),
    });

    const segunda = await updatePage(page.id, actors.alice, {
      content: '<p>tres</p>',
      expectedUpdatedAt: primera!.updatedAt.toISOString(),
    });

    expect(segunda?.content).toBe('<p>tres</p>');
  });

  it('rechaza una versión vieja sin tocar el contenido', async () => {
    const page = await nuevaPagina();
    const versionVieja = page.updatedAt.toISOString();
    await updatePage(page.id, actors.alice, { content: '<p>de otro</p>' });

    await expect(
      updatePage(page.id, actors.alice, { content: '<p>pisado</p>', expectedUpdatedAt: versionVieja }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await contenidoDe(page.id)).toBe('<p>de otro</p>');
  });

  it('sin versión escribe como siempre', async () => {
    const page = await nuevaPagina();
    await updatePage(page.id, actors.alice, { content: '<p>de otro</p>' });

    const updated = await updatePage(page.id, actors.alice, { content: '<p>sin pedir versión</p>' });

    expect(updated?.content).toBe('<p>sin pedir versión</p>');
  });

  it('una página de otro usuario no existe, y eso no es un conflicto', async () => {
    const page = await nuevaPagina();

    await expect(
      updatePage(page.id, actors.bob, {
        content: '<p>ajena</p>',
        expectedUpdatedAt: page.updatedAt.toISOString(),
      }),
    ).resolves.toBeNull();
  });
});

/**
 * Y el borde: que el conflicto llegue al cliente como un 409 y no como un 500.
 * La traducción del error de dominio al status vive en las middlewares del
 * contrato, así que sólo la contesta el handler entero, con una petición y una
 * credencial de verdad.
 */
describe('el conflicto por HTTP', () => {
  async function call(method: string, path: string, body?: unknown) {
    const token = (await generateApiKey(actors.alice, 'contrato')).token;
    const request = new NextRequest(`http://localhost/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const { response } = await apiHandler.handle(request, { prefix: '/api', context: { request } });
    const text = await response!.text();
    return { status: response!.status, body: text.length > 0 ? JSON.parse(text) : undefined };
  }

  it('una versión vieja responde 409 y una al día responde 200', async () => {
    const page = await nuevaPagina();
    const versionVieja = page.updatedAt.toISOString();

    const aldia = await call('PATCH', `/pages/${page.id}`, {
      content: '<p>al día</p>',
      expectedUpdatedAt: versionVieja,
    });
    expect(aldia.status).toBe(200);

    const vieja = await call('PATCH', `/pages/${page.id}`, {
      content: '<p>pisado</p>',
      expectedUpdatedAt: versionVieja,
    });

    expect(vieja.status).toBe(409);
    expect(vieja.body.code).toBe('CONFLICT');
    expect(await contenidoDe(page.id)).toBe('<p>al día</p>');
  });
});
