/**
 * Qué se prueba: lo que **leen** las tres listas que sostienen las pantallas,
 * `tasks.list`, `tasks.bySystem` y `pages.bySystem`, no sólo lo que devuelven.
 *
 * Cuatro criterios. Que lo que abren no crece con lo que descartan: la
 * restricción 9 de AGENTS.md acota lo que una query lee, y las tres recorrían
 * subtareas, papelera o páginas borradas para tirarlas después. Que el orden y
 * el contenido siguen siendo los de antes, desempate incluido: con `sortIndex`
 * a cero en todo lo que no se ha reordenado a mano, el orden visible lo decidía
 * el índice por el que se leía. Que el tope de salida sigue siendo el mismo. Y
 * que `restantes` avisa del recorte aunque los filtros que se resuelven sobre lo
 * leído dejen la lista vacía, que es la forma de mentir que tiene una lista
 * acotada.
 *
 * `tasks.bySystem` entra aquí por lo que lee, no por un tope: se queda sin él a
 * propósito, y el motivo vive en su comentario.
 *
 * La medida se cuenta, no se afirma: `espiar` envuelve el `db` y suma consultas
 * y documentos por separado.
 */

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { espiar, type Cuenta } from '@/shared/testing/espia';
import { listadoDeTareas, tareasDelSistema, TASK_LIST_LIMIT } from './tasks';
import { paginasDelSistema } from './pages';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const BASE = Date.UTC(2026, 5, 15, 12, 0, 0);
const ESTADOS = ['backlog', 'week', 'tomorrow', 'today', 'done'] as const;
const ENERGIAS = ['high', 'medium', 'low'] as const;

type Convex = ReturnType<typeof convexTest>;

/** Mide lo que abre una lectura, con el `db` espiado. */
async function medir<T>(t: Convex, leer: (ctx: MutationCtx) => Promise<T>) {
  const cuenta: Cuenta = { consultas: 0, documentos: 0 };
  const datos = await t.run((ctx) => leer({ ...ctx, db: espiar(ctx.db, cuenta) }));
  return { ...cuenta, datos };
}

/**
 * Trescientas tareas repartidas a propósito para que ningún número coincida con
 * otro: doscientas raíz vivas, sesenta subtareas y cuarenta en la papelera.
 * Todas con `sortIndex` a cero, que es como nacen, menos una que se reordenó a
 * mano y por eso tiene que salir primera.
 */
async function sembrarTareas() {
  const t = convexTest(schema, modules);
  const as = t.withIdentity(ana);
  const userId = await as.mutation(api.users.ensure, {});
  const alfa = await as.mutation(api.systems.create, { name: 'Alfa', color: 'blue', templateType: 'project', icon: 'folder' });
  const beta = await as.mutation(api.systems.create, { name: 'Beta', color: 'green', templateType: 'project', icon: 'folder' });
  const alfaId = alfa.id as Id<'systems'>;
  const betaId = beta.id as Id<'systems'>;

  await t.run(async (ctx) => {
    const comun = { userId, createdBy: userId, createdVia: 'session' as const, priority: 'medium' as const,
      inTodayPlan: false, notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0 };
    const ids: Id<'tasks'>[] = [];
    for (let i = 0; i < 200; i++) {
      ids.push(await ctx.db.insert('tasks', {
        ...comun, systemId: i < 120 ? alfaId : betaId, title: `raiz-${String(i).padStart(3, '0')}`,
        status: ESTADOS[i % ESTADOS.length]!, energyLevel: ENERGIAS[i % ENERGIAS.length]!,
        // La única reordenada a mano: `sortIndex` manda sobre el desempate.
        sortIndex: i === 199 ? -1 : 0, createdAt: BASE + i, updatedAt: BASE + i,
      }));
    }
    for (let i = 0; i < 60; i++) {
      await ctx.db.insert('tasks', {
        ...comun, systemId: alfaId, parentTaskId: ids[i]!, title: `sub-${String(i).padStart(3, '0')}`,
        status: 'backlog', energyLevel: 'medium', sortIndex: 0, createdAt: BASE + i, updatedAt: BASE + i,
      });
    }
    // La papelera se borra al revés de como se creó, para que su orden no se
    // pueda confundir con el de creación.
    for (let i = 0; i < 40; i++) {
      await ctx.db.insert('tasks', {
        ...comun, systemId: i < 25 ? alfaId : betaId, title: `borrada-${String(i).padStart(3, '0')}`,
        status: ESTADOS[i % ESTADOS.length]!, energyLevel: 'medium', sortIndex: 0,
        deletedAt: BASE + (40 - i), createdAt: BASE + i, updatedAt: BASE + i,
      });
    }
  });
  return { t, userId, alfaId };
}

/** Los estados por los que pasa la lista, sin repetir el que ya salió. */
const bloques = (titulos: { status: string }[]) =>
  titulos.map((i) => i.status).filter((estado, n, todos) => estado !== todos[n - 1]);

describe('tasks.list', { timeout: 30_000 }, () => {
  it('lee las raíces vivas y nada más, en el orden que ya servía', async () => {
    const { t, userId } = await sembrarTareas();
    const { consultas, documentos, datos } = await medir(t, (ctx) => listadoDeTareas(ctx, userId, {}));

    expect(datos.items).toHaveLength(200);
    expect(datos.restantes).toBe(0);
    // Una consulta, y doscientos documentos: las doscientas que enseña. Las
    // sesenta subtareas y las cuarenta de la papelera dejan de leerse.
    expect({ consultas, documentos }).toEqual({ consultas: 1, documentos: 200 });

    // `sortIndex` manda: la única reordenada a mano abre la lista.
    expect(datos.items[0]!.title).toBe('raiz-199');
    // Con el resto a cero el desempate es el estado y después la creación, que
    // es el orden que daba el índice viejo y el que la pantalla enseña hoy.
    expect(bloques(datos.items.slice(1))).toEqual(['backlog', 'done', 'today', 'tomorrow', 'week']);
    const backlog = datos.items.slice(1).filter((i) => i.status === 'backlog').map((i) => i.title);
    expect(backlog).toEqual([...backlog].sort());
  });

  it('la papelera se lee por su rango, sin pasar por lo vivo', async () => {
    const { t, userId } = await sembrarTareas();
    const { consultas, documentos, datos } = await medir(t, (ctx) => listadoDeTareas(ctx, userId, { deleted: true }));

    expect(datos.items).toHaveLength(40);
    expect({ consultas, documentos }).toEqual({ consultas: 1, documentos: 40 });
    // Se borraron del 39 al 0, y en ese orden salen.
    expect(datos.items.map((i) => i.title).slice(0, 3)).toEqual(['borrada-039', 'borrada-038', 'borrada-037']);
  });

  /**
   * `status` y `energyLevel` se filtran sobre lo leído, así que pueden dejar la
   * lista vacía teniendo más detrás del tope. Si el aviso de recorte saliera de
   * lo que sobrevive, esa respuesta diría que no falta nada.
   */
  it('avisa del recorte aunque el filtro deje la lista en cero', async () => {
    const t = convexTest(schema, modules);
    const as = t.withIdentity(ana);
    const userId = await as.mutation(api.users.ensure, {});
    const sistema = await as.mutation(api.systems.create, { name: 'Alfa', color: 'blue', templateType: 'project', icon: 'folder' });
    const systemId = sistema.id as Id<'systems'>;
    await t.run(async (ctx) => {
      const comun = { userId, systemId, createdBy: userId, createdVia: 'session' as const, priority: 'medium' as const,
        energyLevel: 'medium' as const, sortIndex: 0, inTodayPlan: false, notifiedBeforeDay: false,
        notifiedDueDay: false, reminderCount: 0, createdAt: BASE, updatedAt: BASE };
      // `backlog` va antes que `week` en el desempate, así que las quinientas una
      // que caben en la lectura son todas backlog y ninguna de las tres de week.
      for (let i = 0; i < TASK_LIST_LIMIT + 2; i++) {
        await ctx.db.insert('tasks', { ...comun, title: `backlog-${i}`, status: 'backlog' });
      }
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert('tasks', { ...comun, title: `week-${i}`, status: 'week' });
      }
    });

    const vacia = await t.run((ctx) => listadoDeTareas(ctx, userId, { status: 'week' }));
    expect(vacia.items).toEqual([]);
    expect(vacia.restantes).toBe(1);
  });

  it('no avisa de recorte cuando el filtro deja pocas y nada quedó fuera', async () => {
    const { t, userId } = await sembrarTareas();

    const { datos } = await medir(t, (ctx) => listadoDeTareas(ctx, userId, { status: 'week' }));

    // Cuarenta de las doscientas raíces vivas, y ninguna lectura cortada.
    expect(datos.items).toHaveLength(40);
    expect(datos.restantes).toBe(0);
  });

  it('la papelera de un sistema no lee la del otro', async () => {
    const { t, userId, alfaId } = await sembrarTareas();
    const { documentos, datos } = await medir(t, (ctx) => listadoDeTareas(ctx, userId, { systemId: alfaId, deleted: true }));

    expect(datos.items).toHaveLength(25);
    expect(documentos).toBe(25);
  });
});

describe('tasks.bySystem', { timeout: 30_000 }, () => {
  it('lee las raíces del sistema, no sus subtareas', async () => {
    const { t, userId, alfaId } = await sembrarTareas();
    const { consultas, documentos, datos } = await medir(t, (ctx) => tareasDelSistema(ctx, userId, { systemId: alfaId }));

    expect(datos).toHaveLength(120);
    // Ciento veinte raíces vivas: las sesenta subtareas del sistema dejan de leerse.
    expect({ consultas, documentos }).toEqual({ consultas: 1, documentos: 120 });
    expect(bloques(datos)).toEqual(['backlog', 'done', 'today', 'tomorrow', 'week']);
  });
});

/** Un sistema de escritura con páginas vivas, borradas y una carpeta. */
async function sembrarPaginas() {
  const t = convexTest(schema, modules);
  const as = t.withIdentity(ana);
  const userId = await as.mutation(api.users.ensure, {});
  const novela = await as.mutation(api.systems.create, { name: 'Novela', color: 'blue', templateType: 'writing', icon: 'book' });
  const systemId = novela.id as Id<'systems'>;
  const obra = await as.mutation(api.folders.create, { systemId, name: 'Obra' });
  const folderId = obra.id as Id<'folders'>;
  await t.run(async (ctx) => {
    const comun = { userId, systemId, createdBy: userId, createdVia: 'session' as const, isPinned: false };
    for (let i = 0; i < 24; i++) {
      await ctx.db.insert('pages', { ...comun, title: `viva-${String(i).padStart(2, '0')}`, content: '<p>texto</p>',
        folderId: i < 6 ? folderId : undefined, createdAt: BASE + i, updatedAt: BASE + i });
    }
    for (let i = 0; i < 16; i++) {
      await ctx.db.insert('pages', { ...comun, title: `borrada-${String(i).padStart(2, '0')}`, content: '<p>texto</p>',
        folderId: i < 4 ? folderId : undefined, deletedAt: BASE, createdAt: BASE + i, updatedAt: BASE + i });
    }
  });
  return { t, userId, systemId, folderId };
}

describe('pages.bySystem', { timeout: 30_000 }, () => {
  it('lee las páginas vivas del sistema, no las de la papelera', async () => {
    const { t, userId, systemId } = await sembrarPaginas();
    const { consultas, documentos, datos } = await medir(t, (ctx) => paginasDelSistema(ctx, userId, { systemId }));

    expect(datos.items).toHaveLength(24);
    expect(datos.restantes).toBe(0);
    // Veinticuatro documentos: las vivas. Las dieciséis de la papelera dejan de
    // leerse. Las cuarenta y nueve consultas son la lista más las dos que cada
    // página abre para sus etiquetas y sus subpáginas, que es lo que el tope
    // existe para acotar.
    expect({ consultas, documentos }).toEqual({ consultas: 49, documentos: 24 });
    expect(datos.items.map((i) => i.title).slice(0, 3)).toEqual(['viva-00', 'viva-01', 'viva-02']);
  });

  it('pedir una carpeta lee esa carpeta, sin su papelera', async () => {
    const { t, userId, systemId, folderId } = await sembrarPaginas();
    const { documentos, datos } = await medir(t, (ctx) => paginasDelSistema(ctx, userId, { systemId, folderId }));

    // Seis vivas: las cuatro borradas de la misma carpeta dejan de leerse.
    expect(datos.items).toHaveLength(6);
    expect(documentos).toBe(6);
  });

  /**
   * Con un ciclo elegido, una carpeta de otro ciclo no aporta nada y el filtro
   * vale igual para todas sus páginas. Leerlas para tirarlas encendería el aviso
   * de recorte por un motivo que no es un recorte.
   */
  it('una carpeta fuera del ciclo no se lee', async () => {
    const t = convexTest(schema, modules);
    const as = t.withIdentity(ana);
    const userId = await as.mutation(api.users.ensure, {});
    const uni = await as.mutation(api.systems.create, { name: 'Universidad', color: 'blue', templateType: 'academic', icon: 'book' });
    const systemId = uni.id as Id<'systems'>;
    const clase = await as.mutation(api.folders.create, { systemId, name: 'Cálculo' });
    const folderId = clase.id as Id<'folders'>;
    await t.run(async (ctx) => {
      const periodId = await ctx.db.insert('academicPeriods', {
        userId, systemId, year: '2026', name: 'Primavera', isCurrent: true, isClosed: false,
        createdAt: BASE, updatedAt: BASE,
      });
      await ctx.db.patch(folderId, { academicPeriodId: periodId });
      for (let i = 0; i < 5; i++) {
        await ctx.db.insert('pages', {
          userId, systemId, folderId, createdBy: userId, createdVia: 'session', isPinned: false,
          title: `apunte-${i}`, content: '<p>texto</p>', createdAt: BASE + i, updatedAt: BASE + i,
        });
      }
    });

    // Pedida sin ciclo: la carpeta lleva uno, así que no cae dentro.
    const { consultas, datos } = await medir(t, (ctx) => paginasDelSistema(ctx, userId, { systemId, folderId, academicPeriodId: null }));

    expect(datos).toEqual({ items: [], restantes: 0 });
    // Una sola consulta, la de las carpetas que resuelve el ciclo: las páginas
    // de esa carpeta no llegan a abrirse.
    expect(consultas).toBe(1);
  });
});
