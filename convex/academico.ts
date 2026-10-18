import { v } from 'convex/values';
import { z } from 'zod';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import { lematizar } from './lib/lemas';
import { recalcularAviso } from './lib/avisos';

// La entrada de lo que publica el aula virtual. Un barrido programado en el
// laptop lee la PVA con el token de Moodle, decide qué es nuevo y sube aquí los
// items ya formados; Kino no habla con la universidad ni guarda nada crudo.
//
// Entra por `convex/http.ts` y no por el conector del MCP por la misma razón
// que el diario: esto escribe tareas directamente, y en el conector cualquier
// token con alcance `write` podría fabricarlas. La credencial es propia del
// barrido y no existe como tool.
//
// **La idempotencia es la pieza central, no un detalle.** El barrido corre cada
// seis horas y en dos máquinas (el laptop cuando está encendido, agentbox
// cuando no), así que el mismo item llega muchas veces y a veces dos veces a la
// vez. La identidad `(userId, 'pva', externalId)` es lo que hace que eso no
// deje cuatro copias de la misma tarea en la semana.

/** Lo que firma una tarea nacida del aula virtual. */
export const PVA_SOURCE = 'pva';

/**
 * Cuántos items admite un envío. El barrido manda lo que cambió desde el
 * anterior, que en un cuatrimestre normal son unos pocos; el tope existe para
 * que un barrido que se despierte con la base entera no se coma el presupuesto
 * de diez segundos de la mutación.
 */
export const ACADEMICO_ITEMS_MAX = 50;

const itemSchema = z.object({
  /** El id del objeto en Moodle, con su tipo delante: `assign:4821`, `resource:99`. */
  externalId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  /** El código de MiCampus (`ICC-321`), que es como Elias llama a la materia. */
  courseCode: z.string().max(32).optional(),
  /** El nombre de la materia, que es por donde se encuentra su carpeta. */
  courseName: z.string().max(200).optional(),
  description: z.string().max(2_000).optional(),
  url: z.string().max(500).optional(),
  /** Cierre publicado por la plataforma, en epoch ms. Moodle lo da en UTC. */
  dueDate: z.number().int().positive().optional(),
});

export const academicoSchema = z.object({
  source: z.literal(PVA_SOURCE),
  items: z.array(itemSchema).min(1).max(ACADEMICO_ITEMS_MAX),
});

export type AcademicoItem = z.infer<typeof itemSchema>;

/** Sin acentos y en minúsculas, que es lo que hace comparable "Gestion" con "Gestión". */
const plano = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

/**
 * El sistema donde vive la universidad. Con más de uno manda el primero de la
 * lista, que es el orden que Elias ve en pantalla.
 *
 * Devuelve null en vez de caer al Inbox a propósito: una tarea del aula en el
 * sistema equivocado se pierde igual que si no se hubiera escrito, y encima
 * nadie se entera. La ruta convierte ese null en un 503 que sí se ve.
 *
 * El `.collect()` sin más rango que el usuario está acotado por construcción:
 * los sistemas son las columnas que caben en una pantalla, y se leen una vez
 * por barrido, no por render.
 */
export const destino = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const activos = await ctx.db
      .query('systems')
      .withIndex('by_user_active', (q) => q.eq('userId', userId).eq('isActive', true))
      .collect();
    const academicos = activos.filter((s) => s.templateType === 'academic').sort((a, b) => a.sortOrder - b.sortOrder);
    return academicos[0]?._id ?? null;
  },
});

/**
 * Las carpetas de materia del ciclo en curso, indexadas por su nombre plano.
 *
 * Solo las del período marcado `isCurrent`: una materia del cuatrimestre pasado
 * puede llamarse igual que una de este, y la tarea nueva pertenece a la de
 * ahora. Sin período en curso no hay carpetas candidatas y todo entra suelto en
 * el sistema, que es recuperable moviéndolo.
 */
async function carpetasPorNombre(
  ctx: { db: import('./_generated/server').QueryCtx['db'] },
  userId: Id<'users'>,
  systemId: Id<'systems'>,
) {
  const periodos = await ctx.db
    .query('academicPeriods')
    .withIndex('by_system', (q) => q.eq('systemId', systemId))
    .collect();
  const actual = periodos.find((p) => p.userId === userId && p.isCurrent && !p.isClosed);
  if (!actual) return new Map<string, Id<'folders'>>();

  const carpetas = await ctx.db
    .query('folders')
    .withIndex('by_system', (q) => q.eq('systemId', systemId))
    .collect();
  const mapa = new Map<string, Id<'folders'>>();
  for (const carpeta of carpetas) {
    if (carpeta.userId !== userId || carpeta.deletedAt !== undefined) continue;
    if (carpeta.academicPeriodId !== actual._id) continue;
    mapa.set(plano(carpeta.name), carpeta._id);
  }
  return mapa;
}

/** Lo que no distingue una materia de otra: artículos y preposiciones. */
const VACIAS = new Set(['a', 'al', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'los', 'y']);

/** El nombre sin el código de sección que la PVA antepone ("CSTI-1930-5225 - "). */
const sinCodigo = (nombre: string) => nombre.replace(/^[a-z]{2,6}-[\d-]+\s*-\s*/, '');

/** Las palabras con significado de un nombre ya plano y sin código. */
const palabras = (nombre: string) => nombre.split(/[^a-z0-9]+/).filter((p) => p.length > 0 && !VACIAS.has(p));

/** Una palabra abrevia a la otra: "seg" a "seguridad", "concurr" a "concurrente". */
const abrevia = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

/** Las mismas palabras, en el mismo orden, abreviadas o no. */
const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((palabra, i) => abrevia(palabra, b[i]));

/**
 * Las palabras del nombre más corto aparecen, en orden y abreviadas o no, en el
 * más largo. "Proyect Integr Desarr Sotfware" contiene a "Proyecto Integrador".
 */
function contenidas(a: string[], b: string[]) {
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  if (corto.length === 0) return false;
  let i = 0;
  for (const palabra of largo) {
    if (i < corto.length && abrevia(corto[i], palabra)) i++;
  }
  return i === corto.length;
}

/**
 * La carpeta de la materia, de lo más estricto a lo más laxo: el nombre exacto,
 * las mismas palabras abreviadas o no, y por último las de uno dentro del otro.
 * Todo sin el código de sección ni artículos.
 *
 * La PVA llama a la materia "CSTI-1930-5225 - Seg. en Tecnología Información"
 * y la carpeta se llama "Seguridad en Tecnologia de Informacion": "seg"
 * abrevia "seguridad" y el resto coincide. Que lo estricto vaya primero es lo
 * que impide que una carpeta "Ingles" se quede con "Inglés para las
 * Ingenierías" cuando existe "Ingles para Ingenierias". En cada paso, con una
 * sola candidata alcanza; con dos no se elige ninguna, porque poner la tarea en
 * la materia equivocada es peor que dejarla suelta.
 */
function carpetaDe(mapa: Map<string, Id<'folders'>>, item: AcademicoItem): Id<'folders'> | undefined {
  if (!item.courseName) return undefined;
  const nombre = sinCodigo(plano(item.courseName));
  const suyas = palabras(nombre);
  const entradas = [...mapa.entries()].map(([clave, id]) => ({ clave, id, palabras: palabras(clave) }));
  const pasos = [
    (c: (typeof entradas)[number]) => c.clave === nombre,
    (c: (typeof entradas)[number]) => iguales(suyas, c.palabras),
    (c: (typeof entradas)[number]) => contenidas(suyas, c.palabras),
  ];
  for (const paso of pasos) {
    const candidatas = entradas.filter(paso);
    if (candidatas.length > 0) return candidatas.length === 1 ? candidatas[0].id : undefined;
  }
  return undefined;
}

/** Lo que el barrido cambiaría de una tarea que ya existe. Vacío significa que no se toca. */
function cambios(tarea: Doc<'tasks'>, item: AcademicoItem, folderId: Id<'folders'> | undefined) {
  const patch: Partial<Doc<'tasks'>> = {};
  if (item.title !== tarea.title) patch.title = item.title;
  if (item.description !== undefined && item.description !== tarea.description) patch.description = item.description;
  if (item.dueDate !== undefined && item.dueDate !== tarea.dueDate) patch.dueDate = item.dueDate;
  // La carpeta solo se rellena, nunca se mueve: si Elias la cambió de sitio, el
  // barrido no tiene por qué saber más que él.
  if (folderId && tarea.folderId === undefined) patch.folderId = folderId;
  return patch;
}

/**
 * Escribe lo que publicó el aula. Interna: la única entrada es la ruta HTTP,
 * que comprueba la credencial del barrido antes de llegar aquí.
 *
 * Tres cosas que no hace, y las tres son la misma regla mirada desde ángulos
 * distintos: lo que Elias tocó, manda.
 *
 *   * Una tarea en la papelera no vuelve. La quitó él y la plataforma sigue
 *     publicando el objeto; reimportarla haría que borrarla no sirviera nunca.
 *   * Una tarea completada no se reabre. Entregó, y el aula tarda en enterarse.
 *   * Una tarea que él movió de carpeta se queda donde la puso.
 */
export const sincronizar = internalMutation({
  args: {
    userId: v.id('users'),
    systemId: v.id('systems'),
    items: v.array(
      v.object({
        externalId: v.string(),
        title: v.string(),
        courseCode: v.optional(v.string()),
        courseName: v.optional(v.string()),
        description: v.optional(v.string()),
        url: v.optional(v.string()),
        dueDate: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    creadas: v.number(),
    actualizadas: v.number(),
    sinCambio: v.number(),
    sinCarpeta: v.array(v.string()),
  }),
  handler: async (ctx, { userId, systemId, items }) => {
    const ahora = Date.now();
    const carpetas = await carpetasPorNombre(ctx, userId, systemId);

    let creadas = 0;
    let actualizadas = 0;
    let sinCambio = 0;
    const sinCarpeta: string[] = [];

    // El orden de llegada decide el sitio en la lista, y el barrido manda lo más
    // viejo primero, así que lo recién publicado queda arriba.
    const base = ahora;

    for (const [posicion, item] of items.entries()) {
      const folderId = carpetaDe(carpetas, item);
      if (!folderId && item.courseName) sinCarpeta.push(item.courseName);

      const existente = await ctx.db
        .query('tasks')
        .withIndex('by_user_external', (q) =>
          q.eq('userId', userId).eq('externalSource', PVA_SOURCE).eq('externalId', item.externalId),
        )
        .first();

      if (existente) {
        if (existente.deletedAt !== undefined || existente.status === 'done') {
          sinCambio += 1;
          continue;
        }
        const patch = cambios(existente, item, folderId);
        if (Object.keys(patch).length === 0) {
          sinCambio += 1;
          continue;
        }
        await ctx.db.patch(existente._id, {
          ...patch,
          lemas: lematizar(patch.title ?? existente.title, patch.description ?? existente.description),
          updatedAt: ahora,
        });
        // El aula movió la fecha: los avisos se mueven con ella.
        if (patch.dueDate !== undefined) await recalcularAviso(ctx, (await ctx.db.get(existente._id))!);
        actualizadas += 1;
        continue;
      }

      const nueva = await ctx.db.insert('tasks', {
        userId,
        systemId,
        folderId,
        title: item.title,
        description: item.description,
        // Nace en el backlog aunque traiga fecha: existe y no está planificada.
        // Quien decide en qué semana entra es el ritual semanal, que es suyo.
        status: 'backlog',
        energyLevel: 'medium',
        // Lo que publica el aula tiene nota detrás: alta, como toda tarea nueva.
        priority: 'high',
        taskType: 'task',
        dueDate: item.dueDate,
        externalSource: PVA_SOURCE,
        externalId: item.externalId,
        metadata: { url: item.url, courseCode: item.courseCode },
        sortIndex: base + posicion,
        inTodayPlan: false,
        notifiedBeforeDay: false,
        notifiedDueDay: false,
        reminderCount: 0,
        lemas: lematizar(item.title, item.description),
        // La vía se firma y el autor no: la tarea nació de la plataforma, no de
        // una decisión suya, y el conteo de trabajo propio mediría de más.
        createdBy: userId,
        createdVia: 'sync',
        createdAt: ahora,
        updatedAt: ahora,
      });
      await recalcularAviso(ctx, (await ctx.db.get(nueva))!);
      creadas += 1;
    }

    return { creadas, actualizadas, sinCambio, sinCarpeta: [...new Set(sinCarpeta)] };
  },
});
