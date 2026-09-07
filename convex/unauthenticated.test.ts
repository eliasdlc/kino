/**
 * Qué se prueba: que **ninguna** función pública de Convex responde sin
 * identidad, y que lo cerrado no lo abre ningún alcance.
 *
 * No lo prueba llamando a las ciento cuarenta, que exigiría inventarles
 * argumentos válidos y probaría sobre todo la imaginación de quien los
 * inventa. Lo prueba por construcción, y son tres piezas que hay que leer
 * juntas:
 *
 *   1. `fn.test.ts` comprueba que `query`, `mutation` y `action` de Convex sólo
 *      se importan en `lib/fn.ts`. Nadie se salta el envoltorio.
 *   2. `reach.test.ts` comprueba que las ciento cuarenta llevan la marca que
 *      sólo pone ese envoltorio. Nadie se registra sin pasar por él.
 *   3. Este fichero comprueba cada puerta del envoltorio, una por alcance.
 *
 * Si las tres están en verde, la afirmación vale para todas. Si alguien añade
 * una cuarta forma de registrar una función, la primera se pone en rojo.
 */

import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** La identidad de un conector OAuth: mismo dueño, otra puerta. */
const conector = (scope: string) => ({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_scope: scope });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code: string }).code : `raw:${String(error)}`;
  }
}

describe('sin identidad', () => {
  it('las cuatro puertas responden lo mismo, y ninguna llega a la base', async () => {
    const t = convexTest(schema, modules);

    expect(await codeOf(t.query(api.lib.fnFixture.read, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.mutation(api.lib.fnFixture.write, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.mutation(api.lib.fnFixture.propose, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.mutation(api.lib.fnFixture.close, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.action(api.lib.fnFixture.act, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.action(api.lib.fnFixture.actClosed, {}))).toBe('UNAUTHENTICATED');

    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(0);
  });
});

describe('lo cerrado', () => {
  it('no lo abre el alcance más alto del conector', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});

    const agente = t.withIdentity(conector('write'));
    expect(await codeOf(agente.mutation(api.lib.fnFixture.close, {}))).toBe('FORBIDDEN_SCOPE');
    expect(await codeOf(agente.action(api.lib.fnFixture.actClosed, {}))).toBe('FORBIDDEN_SCOPE');
  });

  it('se abre desde el navegador, que es la única puerta que tiene', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.lib.fnFixture.write, {});

    expect(await asAna.mutation(api.lib.fnFixture.close, {})).toMatchObject({ channel: 'session' });
    expect(await asAna.action(api.lib.fnFixture.actClosed, {})).toMatchObject({ channel: 'session' });
  });

  it('un conector sí llega a lo que está abierto, para que el test de arriba no pase por otra cosa', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});

    const agente = t.withIdentity(conector('write'));
    expect(await agente.mutation(api.lib.fnFixture.write, {})).toMatchObject({ scope: 'write' });
    expect(await agente.query(api.lib.fnFixture.read, {})).toMatchObject({ scope: 'write' });
  });
});
