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
import { estadoDeHonestidad, techoPropuesto } from './energy';
import { caducada, evidenciaViva, type Cancelable } from './proposals';
import { weekdayOf } from '../src/features/energy/energy.ritual';
import { SYSTEM_TYPE_CONFIG, type SystemType } from '../src/shared/lib/system-types';
import { cronotipoDePico, DIAS_DE_ERROR, VOLVER_POR_DEBAJO_DE } from '../src/features/energy/energy.honesty';
import { findPeakRange } from '../src/features/energy/energy.utils';

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
 * La vuelta del techo, como candidato.
 *
 * Apagarlo lo hace Kino solo porque apagar es la dirección segura; encenderlo
 * es volver a opinar sobre el día de alguien, así que se propone. La clave lleva
 * el error medido: si el instrumento mejora más, vuelve a preguntar con la cifra
 * nueva en vez de quedarse callado con una vieja acusada.
 */
async function candidatoVueltaDelTecho(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  const estado = await estadoDeHonestidad(ctx, user, now);
  if (!estado || estado.decision !== 'proponerVuelta' || estado.error === null) return null;
  return {
    kind: 'techo',
    key: `vuelta:${estado.error}`,
    payload: { vuelta: true, error: estado.error, dias: estado.dias, umbral: VOLVER_POR_DEBAJO_DE },
  };
}

/**
 * El cronotipo diferido, como candidato.
 *
 * El alta sacó esta pregunta del camino de entrada con el argumento de que un
 * perfil declarado el día 1 es una suposición. Este es el "después, cuando haya
 * datos que lo justifiquen": catorce días de curva medida, y la pregunta llega
 * con esa curva delante.
 *
 * **No se pregunta con el techo apagado.** Pedirle a la persona que arregle a
 * mano el cronotipo mientras el instrumento acaba de admitir que no sabe medir
 * es pedirle que tape el fallo de Kino.
 */
async function candidatoCronotipo(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato | null> {
  const estado = await estadoDeHonestidad(ctx, user, now);
  if (!estado || estado.apagado) return null;
  if (estado.dias < DIAS_DE_ERROR || !estado.curva) return null;

  const pico = findPeakRange(estado.curva);
  const medido = cronotipoDePico(pico.start);
  // Proponer el que ya tiene es no proponer nada.
  if (medido === estado.chronotypeDeclarado) return null;

  return {
    kind: 'cronotipo',
    key: medido,
    payload: { medido, declarado: estado.chronotypeDeclarado, dias: estado.dias, pico },
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
 * Items vivos en un sistema a partir de los cuales una carpeta deja de ser una
 * idea y pasa a ser una necesidad. Veinte es lo que cabe en una pantalla larga
 * sin que buscar algo concreto se convierta en leerlo todo.
 */
export const ITEMS_PARA_PROPONER_CARPETA = 20;

/**
 * El empuje de un sistema lleno, como candidato.
 *
 * Es el segundo de los dos empujes del principio 7, y el único de los dos que
 * entra en la cola (D-18): propone crear una carpeta, así que pide una
 * decisión. El de Bandeja no, porque Bandeja no tiene carpetas a propósito y su
 * fila sólo informa.
 *
 * Prioridad cuarta, así que pierde contra cualquier otra cosa. Y sólo apunta a
 * sistemas que **pueden** tener carpetas y todavía no tienen ninguna: proponer
 * una carpeta a quien ya organiza con carpetas es no proponer nada.
 *
 * La clave es el sistema y no su cuenta de items: con la cuenta, cada tarea
 * nueva resucitaría la propuesta y sería la insistencia que el producto no
 * hace. Una vez por sistema.
 */
async function candidatoEmpujeSistema(ctx: Ctx, user: Doc<'users'>): Promise<Candidato | null> {
  const sistemas = await ctx.db
    .query('systems')
    .withIndex('by_user_active', (q) => q.eq('userId', user._id).eq('isActive', true))
    .collect();

  for (const sistema of sistemas.sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (sistema.isInbox) continue;
    const tipo = sistema.templateType as SystemType | undefined;
    if (!tipo || SYSTEM_TYPE_CONFIG[tipo]?.folderRole === null) continue;

    const carpetas = await ctx.db
      .query('folders')
      .withIndex('by_system', (q) => q.eq('systemId', sistema._id))
      .collect();
    if (carpetas.some((carpeta) => carpeta.deletedAt === undefined)) continue;

    const tareas = await ctx.db
      .query('tasks')
      .withIndex('by_system_alive_status', (q) => q.eq('systemId', sistema._id).eq('deletedAt', undefined))
      .collect();
    const vivas = tareas.filter((tarea) => tarea.status !== 'done').length;
    if (vivas < ITEMS_PARA_PROPONER_CARPETA) continue;

    return {
      kind: 'empujeSistema',
      key: sistema._id,
      payload: {
        systemId: sistema._id,
        nombre: sistema.name,
        items: vivas,
        // El sustantivo sale del manifiesto: en un sistema académico se propone
        // una clase y en uno de escritura una obra, sin un `if` por tipo.
        contenedor: SYSTEM_TYPE_CONFIG[tipo].folderRole?.noun ?? 'carpeta',
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
 * lunes, el techo (su propuesta del séptimo día y su vuelta tras apagarse), el
 * cronotipo diferido, el ritual, la propuesta del agente y el empuje de un
 * sistema lleno.
 *
 * `autoArchivo` sigue sin productor y va a seguir sin él: archivar no existe en
 * Kino (D-09), así que nada lo puede emitir. El nivel se queda en la cola
 * porque quitarlo es tocar el schema por nada; el día que archivar vuelva, lo
 * único que falta es quien lo produzca.
 */
async function candidatos(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato[]> {
  const historial = await mostradas(ctx, user._id);
  const crudos = [
    await candidatoLunes(ctx, user, now),
    await candidatoTecho(ctx, user, now),
    await candidatoVueltaDelTecho(ctx, user, now),
    await candidatoCronotipo(ctx, user, now),
    await candidatoRitual(ctx, user, now),
    await candidatoPropuesta(ctx, user, now),
    await candidatoEmpujeSistema(ctx, user),
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
