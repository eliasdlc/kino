/**
 * Las reglas del barrido del aula virtual sobre las tareas: dónde cae cada
 * item, qué pasa cuando el mismo barrido llega dos veces, y qué no puede tocar
 * de lo que Elias ya decidió.
 *
 * Son las tres formas de romper esto: tareas duplicadas porque el barrido corre
 * en dos máquinas, tareas en la materia equivocada, y tareas borradas o
 * entregadas que vuelven solas cada seis horas.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** Un sistema académico con su ciclo en curso y dos materias, más un ciclo cerrado. */
async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const universidad = await asAna.mutation(api.systems.create, {
    name: 'University',
    color: 'blue',
    templateType: 'academic',
    icon: 'book',
  });
  const systemId = universidad.id;

  const { actual, viejo, negocios, seguridad, negociosViejo } = await t.run(async (ctx) => {
    const ahora = Date.now();
    const periodo = (name: string, isCurrent: boolean) =>
      ctx.db.insert('academicPeriods', { userId, systemId, year: '2026', name, isCurrent, isClosed: !isCurrent, createdAt: ahora, updatedAt: ahora });
    const actual = await periodo('2026-4', true);
    const viejo = await periodo('2026-3', false);
    const carpeta = (name: string, academicPeriodId: typeof actual) =>
      ctx.db.insert('folders', {
        userId,
        systemId,
        academicPeriodId,
        name,
        color: 'blue' as const,
        sortIndex: 0,
        createdBy: userId,
        createdVia: 'session' as const,
        createdAt: ahora,
        updatedAt: ahora,
      });
    return {
      actual,
      viejo,
      negocios: await carpeta('Inteligencia de Negocios', actual),
      seguridad: await carpeta('Seguridad en Tecnologia de Informacion', actual),
      negociosViejo: await carpeta('Inteligencia de Negocios', viejo),
    };
  });

  return { t, asAna, userId, systemId, actual, viejo, negocios, seguridad, negociosViejo };
}

const item = (overrides: Record<string, unknown> = {}) => ({
  externalId: 'assign:4821',
  title: 'Practica 5, cubo OLAP',
  courseCode: 'ICC-321',
  courseName: 'Inteligencia de Negocios',
  ...overrides,
});

const tareas = (t: Awaited<ReturnType<typeof seed>>['t'], userId: string) =>
  t.run(async (ctx) =>
    (await ctx.db.query('tasks').collect()).filter((task) => task.userId === userId),
  );

describe('dónde cae lo que publica el aula', () => {
  it('pone la tarea en la carpeta de su materia, del ciclo en curso y no del cerrado', async () => {
    const { t, userId, systemId, negocios } = await seed();

    const res = await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });

    expect(res.creadas).toBe(1);
    const [tarea] = await tareas(t, userId);
    // Lo que rompería: dos ciclos tienen una materia con el mismo nombre, y la
    // tarea de esta semana acabaría en la carpeta del cuatrimestre pasado.
    expect(tarea.folderId).toBe(negocios);
    expect(tarea.status).toBe('backlog');
    expect(tarea.externalSource).toBe('pva');
    expect(tarea.createdVia).toBe('sync');
  });

  it('encuentra la materia aunque la PVA la abrevie', async () => {
    const { t, userId, systemId, seguridad } = await seed();

    await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ externalId: 'assign:99', courseName: 'Seguridad en Tecnologia' })],
    });

    const [tarea] = await tareas(t, userId);
    expect(tarea.folderId).toBe(seguridad);
  });

  it('deja suelta la tarea de una materia que no tiene carpeta, y lo dice', async () => {
    const { t, userId, systemId } = await seed();

    const res = await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ courseName: 'Gestion de Proyectos' })],
    });

    expect(res.sinCarpeta).toEqual(['Gestion de Proyectos']);
    const [tarea] = await tareas(t, userId);
    expect(tarea.folderId).toBeUndefined();
    expect(tarea.systemId).toBe(systemId);
  });
});

describe('el mismo barrido llegando dos veces', () => {
  it('no duplica: la segunda vuelta reconoce el item y no cambia nada', async () => {
    const { t, userId, systemId } = await seed();

    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });
    const segunda = await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });

    // Lo que rompería: el barrido corre en el laptop y en agentbox, así que sin
    // esto la semana termina con cuatro copias de cada tarea.
    expect(segunda).toMatchObject({ creadas: 0, actualizadas: 0, sinCambio: 1 });
    expect(await tareas(t, userId)).toHaveLength(1);
  });

  it('actualiza el título y la fecha cuando la profesora los mueve', async () => {
    const { t, userId, systemId } = await seed();
    const cierre = Date.parse('2026-09-25T02:00:00.000Z');

    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item({ dueDate: cierre })] });
    const res = await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ title: 'Practica 5, cubo OLAP (corregida)', dueDate: cierre + 86_400_000 })],
    });

    expect(res).toMatchObject({ creadas: 0, actualizadas: 1 });
    const [tarea] = await tareas(t, userId);
    expect(tarea.title).toBe('Practica 5, cubo OLAP (corregida)');
    expect(tarea.dueDate).toBe(cierre + 86_400_000);
  });
});

describe('lo que Elias ya decidió', () => {
  it('no resucita una tarea que él mandó a la papelera', async () => {
    const { t, userId, systemId } = await seed();
    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });
    const [tarea] = await tareas(t, userId);
    await t.run((ctx) => ctx.db.patch(tarea._id, { deletedAt: Date.now() }));

    const res = await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });

    // Lo que rompería: borrarla no serviría de nada mientras la PVA siga
    // publicando el objeto, que es todo el cuatrimestre.
    expect(res).toMatchObject({ creadas: 0, sinCambio: 1 });
    expect(await tareas(t, userId)).toHaveLength(1);
  });

  it('no reabre una tarea que él ya completó', async () => {
    const { t, userId, systemId } = await seed();
    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });
    const [tarea] = await tareas(t, userId);
    await t.run((ctx) => ctx.db.patch(tarea._id, { status: 'done', completedAt: Date.now() }));

    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item({ title: 'Otro titulo' })] });

    const [despues] = await tareas(t, userId);
    expect(despues.status).toBe('done');
    expect(despues.title).toBe('Practica 5, cubo OLAP');
  });

  it('no mueve de carpeta una tarea que él cambió de sitio', async () => {
    const { t, userId, systemId, seguridad } = await seed();
    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });
    const [tarea] = await tareas(t, userId);
    await t.run((ctx) => ctx.db.patch(tarea._id, { folderId: seguridad }));

    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [item()] });

    const [despues] = await tareas(t, userId);
    expect(despues.folderId).toBe(seguridad);
  });
});
