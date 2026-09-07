import { v } from 'convex/values';
import { kinoMutation, kinoQuery } from './lib/fn';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { interruptionKind, type InterruptionKind } from './schema';
import { laInterrupcion, type Candidato } from './lib/today/queue';
import { calendarDayInTz, userToday } from './lib/time';
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
 * Todos los candidatos vivos, con el estado de lo que ya se mostró pegado a
 * cada uno.
 *
 * Hoy sólo hay un productor, el ritual, y eso es deliberado: una clase entra en
 * esta lista cuando su línea puede hacer algo. Las propuestas del agente ya se
 * guardan (`convex/proposals.ts`) pero nadie sabe aplicarlas todavía, así que
 * emitirlas aquí pondría en Hoy una línea con dos botones que no llevan a
 * ningún sitio. Entran con *Retirar las dieciséis tools y acotar el alcance de
 * la clave del agente*, que es quien les da pantalla. Lo mismo para el lunes,
 * el auto-archivo, el techo, el cronotipo y el empuje de un sistema: la cola ya
 * sabe dónde ponerlas y lo prueba par a par, y cada ticket engancha la suya.
 */
async function candidatos(ctx: Ctx, user: Doc<'users'>, now: number): Promise<Candidato[]> {
  const historial = await mostradas(ctx, user._id);
  const ritual = await candidatoRitual(ctx, user, now);
  const crudos = ritual ? [ritual] : [];

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
