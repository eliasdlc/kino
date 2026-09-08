import { v } from 'convex/values';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { kinoMutation, kinoQuery, kinoZodMutation } from './lib/fn';
import { invalid, notFound } from './lib/errors';
import { createTaskDoc } from './tasks';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { interruptionKind, type InterruptionKind } from './schema';
import { laInterrupcion, type Candidato } from './lib/today/queue';
import { calendarDayInTz, userToday } from './lib/time';
import { techoPropuesto } from './energy';
import { caducada, evidenciaViva, type Cancelable } from './proposals';
import { weekdayOf } from '../src/features/energy/energy.ritual';

// Hoy: lo único que Kino pregunta en todo el día.
//
// Este slice orquesta, que es la excepción que `AGENTS.md` reconoce para
// `insights` y `scheduler`: reúne candidatos de energía, de tareas, de
// propuestas y del diario, y decide cuál de todos ocupa la única apertura. El
// orden entre ellos no vive aquí sino en `lib/today/queue.ts`, para que se
// pueda probar par a par sin base delante.
//
// Lo que **no** pasa por esta cola, y es una decisión, no un olvido:
//
//  * Una fila que no pide decisión (qué hizo el agente mientras no mirabas, el
//    hueco de datos al volver de una ausencia) vive bajo el plan y no gasta la
//    apertura del día. Sin esa distinción, "el agente hizo algo" se comería la
//    única pregunta.
//  * El empuje de Bandeja: ocho capturas sueltas proponen agruparlas, y eso es
//    una fila de estado sin pregunta (D-18). El empuje de los veinte items de
//    un sistema sí entra, con prioridad cuarta, porque ese sí propone crear
//    una carpeta.
//  * Los push del cron de recordatorios. Ver `convex/pushSend.ts`.

type Ctx = QueryCtx | MutationCtx;

/** El estado guardado de las interrupciones que ya se mostraron alguna vez. */
async function mostradas(ctx: Ctx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('interruptions')
    .withIndex('by_user_surfaced', (q) => q.eq('userId', userId))
    .collect();
  return new Map(rows.map((row) => [`${row.kind}:${row.key}`, row]));
}

/**
 * La semana ISO anterior a un día, en UTC. Es la que la línea del lunes cita:
 * el lunes por la mañana lo que hay que contar es lo que pasó la semana que
 * acaba de cerrarse, no la que empieza hoy.
 */
export function semanaAnterior(instante: number): string {
  const d = new Date(instante - 7 * 86_400_000);
  const jueves = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  jueves.setUTCDate(jueves.getUTCDate() + 4 - (jueves.getUTCDay() || 7));
  const anio = jueves.getUTCFullYear();
  const semana = Math.ceil(((jueves.getTime() - Date.UTC(anio, 0, 1)) / 86_400_000 + 1) / 7);
  return `${anio}-W${String(semana).padStart(2, '0')}`;
}

/**
 * La línea del lunes: lo que hiciste la semana pasada, con una frase tuya
 * literal delante.
 *
 * Sólo el lunes, y sólo si el hook del laptop subió el digest de esa semana. No
 * se inventa nada cuando no hay: una semana sin trabajo no tiene línea, que es
 * distinto de tener una línea que diga que no hubo trabajo.
 */
async function candidatoLunes(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  if (weekdayOf(userToday(user.timezone, now)) !== 'mon') return null;

  const semana = semanaAnterior(now);
  const digest = await ctx.db
    .query('sessionDigests')
    .withIndex('by_user_source_external', (q) => q.eq('userId', user._id).eq('source', 'claude-code').eq('externalId', semana))
    .unique();
  if (!digest) return null;

  const { summary, quote } = digest.digest as { summary?: string; quote?: string };
  return {
    kind: 'lunes',
    key: semana,
    payload: { digestId: digest._id, semana, summary: summary ?? '', quote: quote ?? '' },
  };
}

/**
 * El techo del séptimo día, como candidato.
 *
 * Es el consumidor que la ventana de siete días no tenía: la cola listaba el
 * techo entre sus candidatos y nadie lo emitía. La evidencia son ids de tareas
 * reales, y el cuerpo de la línea las resuelve al pintarlas: si alguna dejó de
 * existir, la propuesta no se pinta en vez de enseñar una cifra que ya no se
 * sostiene.
 */
async function candidatoTecho(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  const techo = await techoPropuesto(ctx, user, now);
  if (!techo) return null;
  // Proponer el techo que ya tiene es no proponer nada.
  if (techo.propuesto === techo.actual) return null;
  return {
    kind: 'techo',
    key: `${techo.cierres}-${techo.propuesto}`,
    payload: { ...techo, evidencia: techo.evidencia },
  };
}

/**
 * El ritual semanal, como candidato. Sólo el día que la persona eligió y sólo
 * si hay algo vencido que repartir: un ritual sin vencidas no tiene nada que
 * preguntar. La clave es el día, así que el ritual de esta semana y el de la
 * siguiente son candidatos distintos.
 */
async function candidatoRitual(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  const settings = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  const hoy = userToday(user.timezone, now);
  if (weekdayOf(hoy) !== (settings?.weeklyReviewDay ?? 'sun')) return null;

  const tareas = await ctx.db
    .query('tasks')
    .withIndex('by_user_alive_status', (q) => q.eq('userId', user._id).eq('deletedAt', undefined))
    .collect();
  const vencidas = tareas.filter(
    (t) => t.parentTaskId === undefined && t.status !== 'done' && t.dueDate !== undefined && calendarDayInTz(t.dueDate, user.timezone) < hoy,
  );
  if (vencidas.length === 0) return null;
  return { kind: 'ritual', key: hoy, payload: { vencidas: vencidas.length } };
}

/**
 * La propuesta del agente que espera decisión, como candidato.
 *
 * La más vieja primero, y sólo si su evidencia sigue viva: una propuesta sobre
 * algo que ya no está no describe nada, así que no gasta la apertura del día.
 * Las caducadas tampoco compiten; se ven en su sitio, no interrumpiendo.
 */
async function candidatoPropuesta(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  const filas = await ctx.db
    .query('proposals')
    .withIndex('by_user_status', (q) => q.eq('userId', user._id).eq('status', 'pending'))
    .collect();

  for (const fila of filas.sort((a, b) => a.createdAt - b.createdAt)) {
    if (caducada(fila, now)) continue;
    const evidencia = await evidenciaViva(ctx, user._id, fila.evidenceType as Cancelable, fila.evidenceId);
    if (!evidencia) continue;
    return {
      kind: 'agente',
      key: fila._id,
      payload: {
        proposalId: fila._id,
        kind: fila.kind,
        motivo: (fila.payload.motivo as string | undefined) ?? null,
        evidencia: {
          tipo: fila.evidenceType,
          id: fila.evidenceId,
          titulo: evidencia.titulo,
          systemId: evidencia.systemId,
        },
      },
    };
  }
  return null;
}

/**
 * Todos los candidatos vivos, con el estado de lo que ya se mostró pegado a
 * cada uno.
 *
 * Una clase entra en esta lista cuando su línea puede hacer algo. Hoy son el
 * lunes, el techo, el ritual y la propuesta del agente.
 *
 * `autoArchivo` sigue sin productor y va a seguir sin él: archivar no existe en
 * Kino (D-09), así que nada lo puede emitir. El nivel se queda en la cola
 * porque quitarlo es tocar el schema por nada; el día que archivar vuelva, lo
 * único que falta es quien lo produzca. El cronotipo y el empuje de un sistema
 * enganchan la suya en sus propios tickets.
 */
async function candidatos(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato[]> {
  const historial = await mostradas(ctx, user._id);
  const crudos = [
    await candidatoLunes(ctx, user, now),
    await candidatoTecho(ctx, user, now),
    await candidatoRitual(ctx, user, now),
    await candidatoPropuesta(ctx, user, now),
  ].filter((candidato): candidato is Candidato => candidato !== null);

  return crudos.map((candidato) => {
    const previo = historial.get(`${candidato.kind}:${candidato.key}`);
    return { ...candidato, surfacedAt: previo?.surfacedAt, acknowledgedAt: previo?.acknowledgedAt };
  });
}

/**
 * La única interrupción del día, o `null`. `null` es un resultado normal: Hoy
 * no pinta un hueco cuando no hay nada que preguntar.
 */
export const interruption = kinoQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const elegida = laInterrupcion(await candidatos(ctx, ctx.user, now), now);
    if (!elegida) return null;
    return { kind: elegida.kind, key: elegida.key, surfacedAt: elegida.surfacedAt ?? null, payload: elegida.payload };
  },
});

/**
 * Días fuera a partir de los cuales vale la pena decir algo al volver.
 *
 * Menos de una semana no cambia el techo del día ni deja vencimientos que
 * contar, así que la fila no tendría ninguna cifra que enseñar y sería una
 * frase por cortesía. Con siete, cuando aparece, trae números.
 */
export const DIAS_DE_AUSENCIA = 7;

/**
 * Lo que pasó mientras no estabas. **No es una interrupción**: no pide ninguna
 * decisión, así que no pasa por la cola, no gasta la apertura del día y vive
 * bajo el plan. Si hoy además hay una interrupción, salen las dos.
 *
 * Devuelve `null` cuando no hubo ausencia. Las tres cifras salen de una
 * consulta de verdad, y cuando una de ellas no existe (no hay datos de energía
 * de esos días) se dice, no se calla.
 */
export const returnNotice = kinoQuery({
  args: {},
  handler: async (ctx) => {
    const desde = ctx.user.previousActiveAt;
    if (desde === undefined) return null;

    const now = Date.now();
    const dias = Math.floor((now - desde) / 86_400_000);
    if (dias < DIAS_DE_AUSENCIA) return null;

    const tareas = await ctx.db
      .query('tasks')
      .withIndex('by_user_alive_status', (q) => q.eq('userId', ctx.user._id).eq('deletedAt', undefined))
      .collect();

    // Venció mientras no estabas: la fecha límite cae dentro del hueco y la
    // tarea sigue sin completarse.
    const vencidas = tareas.filter(
      (t) => t.status !== 'done' && t.dueDate !== undefined && t.dueDate >= desde && t.dueDate <= now,
    ).length;
    // Se repitió sola: la sembró la recurrencia, que firma como `system`.
    const repetidas = tareas.filter(
      (t) => t.recurrenceParentId !== undefined && t.createdVia === 'system' && t.createdAt >= desde,
    ).length;

    const checkins = await ctx.db
      .query('energyCheckins')
      .withIndex('by_user_day_slot', (q) => q.eq('userId', ctx.user._id))
      .collect();
    const conEnergia = checkins.some((checkin) => checkin.createdAt >= desde && checkin.createdAt <= now);

    return { dias, ultimaSesion: new Date(desde).toISOString(), vencidas, repetidas, conEnergia };
  },
});

async function filaDe(ctx: MutationCtx, userId: Id<'users'>, kind: InterruptionKind, key: string) {
  return ctx.db
    .query('interruptions')
    .withIndex('by_user_kind_key', (q) => q.eq('userId', userId).eq('kind', kind).eq('key', key))
    .unique();
}

/**
 * Deja constancia de que la interrupción se pintó. El reloj de los dos días
 * arranca aquí y no se reinicia: mostrarla otra vez mañana no le regala dos
 * días más, que es justo lo que haría que una propuesta no cediera nunca.
 */
export const markSurfaced = kinoMutation({
  args: { kind: interruptionKind, key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { kind, key }) => {
    if (await filaDe(ctx, ctx.user._id, kind, key)) return false;
    await ctx.db.insert('interruptions', { userId: ctx.user._id, kind, key, surfacedAt: Date.now() });
    return true;
  },
});

/**
 * La persona contestó, con cualquiera de los dos botones. La interrupción se
 * va y no vuelve: aceptar y descartar cierran igual, porque lo que la cola mide
 * es si hubo respuesta, no cuál fue.
 */
export const acknowledge = kinoMutation({
  args: { kind: interruptionKind, key: v.string() },
  returns: v.null(),
  handler: async (ctx, { kind, key }) => {
    const now = Date.now();
    const fila = await filaDe(ctx, ctx.user._id, kind, key);
    if (fila) await ctx.db.patch(fila._id, { acknowledgedAt: now });
    else await ctx.db.insert('interruptions', { userId: ctx.user._id, kind, key, surfacedAt: now, acknowledgedAt: now });
    return null;
  },
});

/**
 * Convierte la línea del lunes en una tarea, y deja escrito de qué digest
 * salió.
 *
 * `digestId` es lo que hace que la puerta de muerte del diario cuente **acción
 * real** y no pulsaciones de botón (D-05): dentro de diez semanas la consulta
 * cuenta tareas con digest tocadas en 24 horas, no acuses. Por eso crear la
 * tarea y acusar la línea son la misma mutación: si fueran dos, una podría
 * ocurrir sin la otra y el conteo mediría otra cosa.
 */
export const taskFromDigest = kinoZodMutation({
  args: { key: z.string().min(1), title: z.string().min(1).max(500), digestId: zid('sessionDigests') },
  handler: async (ctx, { key, title, digestId }) => {
    const digest = await ctx.db.get(digestId);
    if (!digest || digest.userId !== ctx.user._id) notFound('Digest not found');

    const inbox = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', ctx.user._id).eq('isInbox', true))
      .unique();
    if (!inbox) invalid('No hay bandeja donde poner la tarea.');

    const task = await createTaskDoc(ctx, ctx.user._id, ctx.channel, ctx.user.timezone, {
      systemId: inbox._id,
      title,
    });
    await ctx.db.patch(task._id, { digestId });

    const now = Date.now();
    const fila = await filaDe(ctx, ctx.user._id, 'lunes', key);
    if (fila) await ctx.db.patch(fila._id, { acknowledgedAt: now });
    else await ctx.db.insert('interruptions', { userId: ctx.user._id, kind: 'lunes', key, surfacedAt: now, acknowledgedAt: now });

    return { id: task._id };
  },
});
