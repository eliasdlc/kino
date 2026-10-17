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

describe('lo que la clase ya escribió', () => {
  // La clase escribe la tarea apenas el profesor la anuncia, citando el cmid de
  // la actividad; la PVA la publica después con otro id. Sin reconocerla, cada
  // entrega aparecería dos veces en la carpeta.
  async function conTareaDeClase(seedado: Awaited<ReturnType<typeof seed>>, over: { status?: 'backlog' | 'done'; description?: string } = {}) {
    const { asAna, systemId, negocios } = seedado;
    const tarea = await asAna.mutation(api.tasks.create, {
      systemId,
      folderId: negocios,
      title: 'Hacer la Práctica I de BI con el dataset del profe',
      description: over.description ?? 'Anunciada en la clase del 23 de septiembre. PVA cmid:3704387. Usar el dataset de ventas.',
      dueDate: '2026-09-29T00:00:00.000Z',
    });
    if (over.status === 'done') await asAna.mutation(api.tasks.toggle, { id: tarea.id });
    return tarea.id;
  }

  it('adopta la tarea de la clase que cita el mismo cmid en vez de crear otra', async () => {
    const seedado = await seed();
    const { t, userId, systemId } = seedado;
    const id = await conTareaDeClase(seedado);
    const cierre = Date.parse('2026-09-30T14:00:00.000Z');

    const res = await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ externalId: 'assign:634782', cmid: 3704387, title: 'Práctica I: Diseño e implementación', dueDate: cierre })],
    });

    expect(res).toMatchObject({ creadas: 0, adoptadas: 1 });
    const todas = await tareas(t, userId);
    expect(todas).toHaveLength(1);
    const [tarea] = todas;
    expect(tarea._id).toBe(id);
    expect(tarea).toMatchObject({ externalSource: 'pva', externalId: 'assign:634782', dueDate: cierre });
    // Lo que escribió la clase se queda: el aula sólo manda en la fecha.
    expect(tarea.title).toBe('Hacer la Práctica I de BI con el dataset del profe');
    expect(tarea.description).toContain('Usar el dataset de ventas');
  });

  it('una vez adoptada, los barridos siguientes no le cambian el título ni la descripción', async () => {
    const seedado = await seed();
    const { t, userId, systemId } = seedado;
    await conTareaDeClase(seedado);
    const base = item({ externalId: 'assign:634782', cmid: 3704387, title: 'Práctica I: Diseño e implementación' });
    await t.mutation(internal.academico.sincronizar, { userId, systemId, items: [base] });
    await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [{ ...base, title: 'Práctica I (corregida)', description: 'Consigna de la plataforma' }],
    });
    const [tarea] = await tareas(t, userId);
    expect(tarea.title).toBe('Hacer la Práctica I de BI con el dataset del profe');
    expect(tarea.description).toContain('Usar el dataset de ventas');
  });

  it('una tarea de clase ya hecha se adopta y sigue hecha, sin crear otra', async () => {
    const seedado = await seed();
    const { t, userId, systemId } = seedado;
    await conTareaDeClase(seedado, { status: 'done' });
    const res = await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ externalId: 'assign:634782', cmid: 3704387, dueDate: Date.parse('2026-10-30T14:00:00.000Z') })],
    });
    expect(res).toMatchObject({ creadas: 0, adoptadas: 1 });
    const todas = await tareas(t, userId);
    expect(todas).toHaveLength(1);
    expect(todas[0]!.status).toBe('done');
  });

  it('sin un cmid que coincida, crea la tarea como siempre', async () => {
    const seedado = await seed();
    const { t, userId, systemId } = seedado;
    await conTareaDeClase(seedado);
    const res = await t.mutation(internal.academico.sincronizar, {
      userId,
      systemId,
      items: [item({ externalId: 'assign:634790', cmid: 3711111 }), item({ externalId: 'assign:634791' })],
    });
    expect(res).toMatchObject({ creadas: 2, adoptadas: 0 });
    expect(await tareas(t, userId)).toHaveLength(3);
  });
});
