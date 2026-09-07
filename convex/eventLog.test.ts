import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { boundPayload, PAYLOAD_MAX_BYTES, RETENTION_DAYS } from './eventLog';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

const DIA = 86_400_000;

describe('el diff acotado', () => {
  it('un payload que cabe pasa entero', () => {
    const payload = { antes: 'a', despues: 'b' };
    expect(boundPayload(payload)).toBe(payload);
  });

  it('uno que se pasa se sustituye por la marca, no se trunca a medias', () => {
    const grande = { texto: 'x'.repeat(PAYLOAD_MAX_BYTES + 1) };
    const acotado = boundPayload(grande);
    expect(acotado.omitido).toBe(true);
    expect(acotado.bytes).toBeGreaterThan(PAYLOAD_MAX_BYTES);
    // Sigue siendo JSON válido y pequeño.
    expect(new TextEncoder().encode(JSON.stringify(acotado)).byteLength).toBeLessThan(PAYLOAD_MAX_BYTES);
  });
});

describe('la poda del log', () => {
  /** Siembra `total` eventos repartidos entre viejos y recientes. */
  async function sembrar(t: ReturnType<typeof convexTest>, userId: Id<'users'>, viejos: number, recientes: number) {
    const ahora = Date.now();
    const CHUNK = 5_000;
    const insertar = async (cuantos: number, occurredAt: () => number) => {
      for (let hecho = 0; hecho < cuantos; hecho += CHUNK) {
        const lote = Math.min(CHUNK, cuantos - hecho);
        await t.run(async (ctx) => {
          for (let i = 0; i < lote; i += 1) {
            await ctx.db.insert('eventLog', {
              userId,
              actorId: userId,
              actorChannel: 'session',
              action: 'task.create',
              targetType: 'task',
              targetId: `tasks:${hecho + i}`,
              payload: {},
              occurredAt: occurredAt(),
            });
          }
        });
      }
    };
    // Viejos: entre 31 y 60 días. Recientes: menos de 30.
    await insertar(viejos, () => ahora - (RETENTION_DAYS + 1) * DIA - Math.floor(Math.random() * 29) * DIA);
    await insertar(recientes, () => ahora - Math.floor(Math.random() * (RETENTION_DAYS - 1)) * DIA);
  }

  it('cien mil filas se podan por lotes, sin tocar lo de dentro de los treinta días', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.withIdentity(ana).mutation(api.users.ensure, {});
    await sembrar(t, userId, 90_000, 10_000);
    expect(await t.run((ctx) => ctx.db.query('eventLog').collect().then((r) => r.length))).toBe(100_000);

    // Cada llamada borra a lo sumo su tope; se repite hasta que dice que acabó.
    const TOPE = 10_000;
    let vueltas = 0;
    let borradas = 0;
    for (;;) {
      const paso = await t.mutation(internal.eventLog.podar, { limite: TOPE });
      borradas += paso.borradas;
      vueltas += 1;
      expect(paso.borradas).toBeLessThanOrEqual(TOPE);
      if (!paso.quedan) break;
      expect(vueltas).toBeLessThan(20);
    }

    expect(borradas).toBe(90_000);
    expect(vueltas).toBeGreaterThan(1);
    const quedan = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(quedan).toHaveLength(10_000);
    const corte = Date.now() - RETENTION_DAYS * DIA;
    expect(quedan.every((doc) => doc.occurredAt >= corte)).toBe(true);
  }, 300_000);

  it('podar una tabla ya podada no borra nada', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.withIdentity(ana).mutation(api.users.ensure, {});
    await sembrar(t, userId, 10, 5);

    expect((await t.mutation(internal.eventLog.podar, { limite: 100 })).borradas).toBe(10);
    const segunda = await t.mutation(internal.eventLog.podar, { limite: 100 });
    expect(segunda).toEqual({ borradas: 0, quedan: false });
    expect(await t.run((ctx) => ctx.db.query('eventLog').collect().then((r) => r.length))).toBe(5);
  });
});
