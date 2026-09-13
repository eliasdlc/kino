/**
 * Qué se prueba: los cuatro estados de una captura, que nada se convierte en
 * item sin un gesto, que la retención avisa **antes** de caducar y que lo
 * caducado se sigue viendo antes de irse, y que una captura sin confirmar no
 * cruza de cuenta. El reloj se inyecta: una retención que sólo se puede probar
 * esperando treinta días no se prueba.
 */
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { AVISO_DIAS, GRACIA_DIAS, RETENCION_DIAS } from './captures';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };
const DIA = 86_400_000;
const ARRANQUE = new Date('2026-09-13T12:00:00Z').getTime();

afterEach(() => {
  vi.useRealTimers();
});

/** Congela el reloj donde haga falta, sin tocar los temporizadores del test. */
function enElDia(dia: number) {
  vi.setSystemTime(ARRANQUE + dia * DIA);
}

async function seed(t: ReturnType<typeof convexTest>, quien = ana) {
  const sesion = t.withIdentity(quien);
  await sesion.mutation(api.users.ensure, {});
  // Bandeja es el destino por defecto de lo que se confirma, así que existe
  // desde el alta igual que en la app.
  await sesion.mutation(api.systems.setup, {});
  return sesion;
}

/** Lo que el agente devolvería para una foto de pizarra. */
async function conPropuesta(t: ReturnType<typeof convexTest>, capturaId: string, items: unknown[]) {
  await t.run(async (ctx) => {
    await ctx.db.patch(capturaId as never, { proposedItems: items as never });
  });
}

describe('los cuatro estados', () => {
  it('lo compartido nace sin confirmar y se ve en Bandeja', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);

    const captura = await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea de la tesis' });

    expect(captura.status).toBe('pending');
    const enBandeja = await asAna.query(api.captures.pendientes, {});
    expect(enBandeja).toHaveLength(1);
    expect(enBandeja[0]).toMatchObject({ kind: 'text', text: 'idea de la tesis', status: 'pending' });
  });

  it('descartar es una decisión de la persona, y la saca de Bandeja', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'text', text: 'nada importante' });

    await asAna.mutation(api.captures.descartar, { id: captura.id });

    expect(await asAna.query(api.captures.pendientes, {})).toEqual([]);
  });

  it('confirmar crea las tareas que se marcaron, y sólo esas', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'photo', blobPath: 'k/pizarra.jpg' });
    await conPropuesta(t, captura.id, [
      { title: 'Repasar el parcial' },
      { title: 'Entregar el diagrama ER' },
      { title: 'Preguntar por la rúbrica' },
    ]);

    const resultado = await asAna.mutation(api.captures.confirmar, { id: captura.id, indices: [0, 2] });

    expect(resultado).toEqual({ creadas: 2 });
    const tareas = await asAna.query(api.tasks.list, {});
    expect(tareas.items.map((t) => t.title).sort()).toEqual(['Preguntar por la rúbrica', 'Repasar el parcial']);
    expect(await asAna.query(api.captures.pendientes, {})).toEqual([]);
  });

  it('nada se convierte en item sin un gesto: sin confirmar no hay tareas', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'photo', blobPath: 'k/pizarra.jpg' });
    await conPropuesta(t, captura.id, [{ title: 'Repasar el parcial' }]);

    expect((await asAna.query(api.tasks.list, {})).items).toEqual([]);
  });

  it('una captura que el agente no entendió no se puede confirmar a ciegas', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'photo', blobPath: 'k/borrosa.jpg' });

    await expect(asAna.mutation(api.captures.confirmar, { id: captura.id, indices: [0] })).rejects.toThrow();
  });
});

describe('la retención avisa antes, nunca después', () => {
  it('recién llegada no avisa nada', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    const [fila] = await asAna.query(api.captures.pendientes, {});
    expect(fila).toMatchObject({ avisa: false, diasRestantes: RETENCION_DIAS });
  });

  it('el aviso empieza una semana antes de caducar, no el día de', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS - AVISO_DIAS - 1);
    expect((await asAna.query(api.captures.pendientes, {}))[0]).toMatchObject({ avisa: false });

    enElDia(RETENCION_DIAS - AVISO_DIAS);
    expect((await asAna.query(api.captures.pendientes, {}))[0]).toMatchObject({ avisa: true, diasRestantes: AVISO_DIAS });
  });

  it('caducar no la borra: se sigue viendo con su estado', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS + 1);
    const podada = await t.mutation(internal.captures.podar, {});

    expect(podada).toMatchObject({ caducadas: 1, borradas: 0 });
    expect((await asAna.query(api.captures.pendientes, {}))[0]).toMatchObject({ status: 'expired' });
  });

  it('sólo después de la semana de gracia se va de verdad', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS + 1);
    await t.mutation(internal.captures.podar, {});
    enElDia(RETENCION_DIAS + GRACIA_DIAS + 1);
    const segunda = await t.mutation(internal.captures.podar, {});

    expect(segunda).toMatchObject({ borradas: 1 });
    expect(await asAna.query(api.captures.pendientes, {})).toEqual([]);
  });

  it('caducar deja su fila en el log: nunca se archiva en silencio', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS + 1);
    await t.mutation(internal.captures.podar, {});

    const acciones = await t.run(async (ctx) =>
      (await ctx.db.query('eventLog').collect()).map((fila) => fila.action),
    );
    expect(acciones).toContain('capture.expire');
  });

  it('reejecutar la poda sobre una tabla ya podada no borra nada', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS + 1);
    await t.mutation(internal.captures.podar, {});
    const segunda = await t.mutation(internal.captures.podar, {});

    expect(segunda).toMatchObject({ caducadas: 0, borradas: 0 });
  });

  it('la entrada de cron poda el log y las capturas de una vez', async () => {
    const t = convexTest(schema, modules);
    vi.useFakeTimers();
    enElDia(0);
    const asAna = await seed(t);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    enElDia(RETENCION_DIAS + 1);
    const resultado = await t.mutation(internal.podas.diaria, {});

    expect(resultado.capturas).toMatchObject({ caducadas: 1 });
    expect(resultado.eventos).toHaveProperty('borradas');
  });
});

describe('una captura sin confirmar es de quien la mandó', () => {
  it('no la ve otra cuenta, aunque comparta navegador', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const asBeto = await seed(t, beto);
    await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea de Ana' });

    expect(await asBeto.query(api.captures.pendientes, {})).toEqual([]);
  });

  it('ni la puede confirmar señalándola por su id', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const asBeto = await seed(t, beto);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea de Ana' });
    await conPropuesta(t, captura.id, [{ title: 'Lo de Ana' }]);

    await expect(asBeto.mutation(api.captures.confirmar, { id: captura.id, indices: [0] })).rejects.toThrow();
  });
});

describe('descartar se puede deshacer, caducar no', () => {
  it('el descarte guarda el estado anterior, que es lo que el deshacer restaura', async () => {
    const t = convexTest(schema, modules);
    const asAna = await seed(t);
    const captura = await asAna.mutation(api.captures.crear, { kind: 'text', text: 'idea' });

    await asAna.mutation(api.captures.descartar, { id: captura.id });

    const fila = await t.run(async (ctx) =>
      (await ctx.db.query('eventLog').collect()).find((e) => e.action === 'capture.discard'),
    );
    expect(fila?.payload).toEqual({ status: 'pending' });
  });
});
