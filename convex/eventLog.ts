import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { notFound } from './lib/errors';
import { kinoMutation, kinoQuery } from './lib/fn';
import { calendarDayInTz } from './lib/time';
import { itemType, type ActorChannel } from './schema';

// El registro de lo que el usuario pidió que se escribiera. Sostiene el log de
// actividad, el deshacer y las aristas automáticas.
//
// ── El invariante ──────────────────────────────────────────────────────────
// Está escrito aquí y en ningún otro sitio, porque `recordEvent` es el único
// escritor y no hay dónde más ponerlo:
//
//   **Una fila del log es una acción que alguien pidió, y nunca una escritura
//   derivada de otra acción ya registrada.**
//
// La coletilla no es una rendija, es la forma exacta del invariante. Sin ella
// contradice al propio schema: `sync` y `system` son canales del actor, así
// que hay escrituras que nadie pidió a mano (la sincronización con GitHub, la
// siguiente ocurrencia de una serie recurrente) y ésas sí dejan fila, porque
// no hay ninguna otra que las cuente. Lo que no deja fila es la cascada de un
// borrado, el `syncAutoReminders` de una edición o el rollover del plan de
// hoy: consecuencias de algo que ya está en el log, y una fila por cada una
// convertiría el log en un rastro de la implementación en vez de un rastro de
// lo que la persona hizo.
//
// Cada llamada a `recordEvent` es una de las primeras; cada sitio que decide
// no llamarla escribe al lado de cuál acción registrada lo cubre.
//
// ── Retención ──────────────────────────────────────────────────────────────
// Treinta días. La dispara el cron `event-log-prune`, cada día a las 12:20
// UTC, veinte minutos después del snapshot diario para no competir con él.
// La poda va por lotes con tope: borra hasta PRUNE_BATCH filas por ejecución y
// se reprograma sola mientras queden, de modo que una tabla con millones de
// filas se vacía en muchas mutaciones cortas y ninguna se acerca al límite de
// tiempo de Convex.

/** Días que sobrevive un evento. */
export const RETENTION_DAYS = 30;

/**
 * Filas por ejecución. Medido sobre `by_occurred`, que devuelve las más viejas
 * primero: mil borrados es un orden de magnitud por debajo del límite de una
 * mutación, así que el lote entra holgado dentro de los diez segundos.
 */
export const PRUNE_BATCH = 1_000;

/** Bytes máximos del diff que un evento guarda. Lo que pase se descarta. */
export const PAYLOAD_MAX_BYTES = 2_048;

/**
 * Recorta el diff al tope del contrato. Un payload que se pasa no se trunca a
 * medias (dejaría un objeto ilegible): se sustituye por la marca de que hubo
 * más, y el evento sigue sirviendo para el log aunque no para el deshacer.
 */
export function boundPayload(payload: Record<string, unknown>, tope = PAYLOAD_MAX_BYTES): Record<string, unknown> {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  if (encoded.byteLength <= tope) return payload;
  return { omitido: true, bytes: encoded.byteLength };
}

/**
 * Campos que toda escritura toca y que nunca son un cambio que alguien pidió,
 * así que no entran en el diff de una edición: revertirlos a mano sería
 * revertir dos veces lo mismo. `lemas` es derivado del título y del cuerpo, y
 * vuelve solo en cuanto uno de los dos vuelve.
 */
const DERIVADOS = new Set(['updatedAt', 'lemas']);

/**
 * En qué se diferencian dos versiones de un documento, con el valor que el
 * campo tenía **antes**.
 *
 * Es el payload de toda edición, y la forma la decide el deshacer campo a
 * campo: para revertir hacen falta los valores anteriores de exactamente los
 * campos que cambiaron, ni uno más. Un campo que se reescribe con el mismo
 * valor no entra, porque deshacerlo no devolvería nada.
 *
 * Recorre la unión de las dos versiones y no sólo la nueva: un campo que la
 * edición borró desaparece del documento, y ése es justo el que más falta hace
 * para deshacer. `null` significa que no había valor.
 */
export function diferencias<T extends object>(antes: T, despues: T): Record<string, unknown> {
  const cambios: Record<string, unknown> = {};
  for (const campo of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if (campo.startsWith('_') || DERIVADOS.has(campo)) continue;
    const previo = (antes as Record<string, unknown>)[campo];
    if (previo === (despues as Record<string, unknown>)[campo]) continue;
    cambios[campo] = previo ?? null;
  }
  return cambios;
}

/** Lo que un evento necesita saber de quien lo provocó. */
export type EventInput = {
  userId: Id<'users'>;
  actorId?: Id<'users'>;
  actorChannel: ActorChannel;
  systemId?: Id<'systems'>;
  /**
   * El cliente OAuth que actuó. No hace falta pasarlo: `recordEvent` lo toma
   * del contexto, que es donde el envoltorio lo dejó ya verificado.
   */
  clientId?: string;
  action: string;
  targetType: Doc<'eventLog'>['targetType'];
  targetId: string;
  payload?: Record<string, unknown>;
  /** La propuesta que el usuario aceptó, cuando la escritura viene de una. */
  proposalId?: Id<'proposals'>;
  /**
   * La versión anterior del capítulo, cuando el cuerpo cambió. Es lo que evita
   * meter veinte mil caracteres dentro de un payload acotado a 2.048 bytes: el
   * deshacer de una edición de cuaderno restaura desde aquí, no desde el diff.
   */
  snapshotId?: Id<'pageSnapshots'>;
  /**
   * Un tope distinto para este evento, y **hace falta escribir por qué** en la
   * llamada. Los 2.048 bytes salen de multiplicar la fila por lo que el rate
   * limit deja escribir, así que sólo puede pasarse quien no escriba a ese
   * ritmo. Hoy hay una sola: el ritual semanal, una fila por persona y semana.
   */
  payloadMaxBytes?: number;
};

/**
 * Deja una fila en el log. Es el único escritor: todo lo que quiera registrar
 * algo pasa por aquí, para que el recorte del payload no dependa del llamante.
 */
export async function recordEvent(
  ctx: MutationCtx & { clientId?: string },
  input: EventInput,
): Promise<Id<'eventLog'>> {
  return ctx.db.insert('eventLog', {
    userId: input.userId,
    systemId: input.systemId,
    actorId: input.actorId ?? input.userId,
    actorChannel: input.actorChannel,
    clientId: input.clientId ?? ctx.clientId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: boundPayload(input.payload ?? {}, input.payloadMaxBytes),
    proposalId: input.proposalId,
    snapshotId: input.snapshotId,
    occurredAt: Date.now(),
  });
}

// ── Quién aparece en una fila ───────────────────────────────────────────────

/**
 * El actor de un evento, tal como el lector lo puede ver.
 *
 * Son **dos variantes y no un objeto con el nombre opcional**: la redactada no
 * tiene campo de nombre, así que una lectura que no debe enseñarlo no puede
 * construir un objeto que lo lleve aunque el autor del código se despiste. La
 * regla de quién ve qué hizo quién dentro de un sistema compartido la sostiene
 * el compilador, que es de lo que se trataba.
 *
 * El canal sobrevive a la redacción a propósito: saber que algo lo escribió un
 * agente y no una persona es la mitad del valor del log, y no dice quién.
 */
export type Actor =
  | { readonly kind: 'propio'; readonly channel: ActorChannel; readonly name: string }
  | { readonly kind: 'redactado'; readonly channel: ActorChannel };

/**
 * El actor de un evento para un lector concreto. Sólo se nombra al lector: el
 * nombre de otra persona no se redacta después de leerlo, no se lee nunca.
 */
export function actorDe(evento: Doc<'eventLog'>, lector: Doc<'users'>): Actor {
  if (evento.actorId === lector._id) return { kind: 'propio', channel: evento.actorChannel, name: lector.name };
  return { kind: 'redactado', channel: evento.actorChannel };
}

// ── El deshacer ─────────────────────────────────────────────────────────────

/**
 * Cómo se deshace cada acción, o por qué no se puede.
 *
 * Cuatro variantes y la última lleva su motivo dentro, así que **una operación
 * no deshacible no se calla**: la fila lo dice en pantalla y la mutación lo
 * devuelve en su respuesta. Un `Record` sin la variante `no` dejaría el motivo
 * fuera del tipo y acabaría escrito sólo en un comentario.
 */
export type FormaDeDeshacer =
  | { readonly forma: 'fields' }
  | { readonly forma: 'snapshot' }
  | { readonly forma: 'inverse' }
  | { readonly forma: 'no'; readonly motivo: string };

/**
 * La forma que le toca a cada acción. `item-events.test.ts` recorre las
 * acciones que `convex/` escribe de verdad y falla si alguna falta aquí, así
 * que un escritor nuevo no puede llegar sin declarar si se deshace.
 */
export const DESHACER: Record<string, FormaDeDeshacer> = {
  'task.create': { forma: 'inverse' },
  'task.update': { forma: 'fields' },
  'task.remove': { forma: 'inverse' },
  'task.restore': { forma: 'inverse' },
  'task.toggle': { forma: 'fields' },
  'task.move': { forma: 'fields' },
  'task.moveBoard': { forma: 'fields' },
  'task.createTimeLog': {
    forma: 'no',
    motivo: 'El tiempo trabajado es un hecho, no una edición: borrarlo sería borrar que trabajaste.',
  },

  'page.create': { forma: 'inverse' },
  'page.update': { forma: 'snapshot' },
  'page.remove': { forma: 'inverse' },
  'page.restore': { forma: 'inverse' },
  'page.linkTask': { forma: 'inverse' },
  'page.unlinkTask': { forma: 'inverse' },
  'page.addTag': { forma: 'inverse' },
  'page.removeTag': { forma: 'inverse' },

  'folder.create': { forma: 'inverse' },
  'folder.update': { forma: 'fields' },
  'folder.remove': { forma: 'inverse' },
  'folder.restore': { forma: 'inverse' },

  'stickyNote.create': { forma: 'inverse' },
  'stickyNote.update': { forma: 'fields' },
  'stickyNote.remove': { forma: 'inverse' },
  'stickyNote.restore': { forma: 'inverse' },
  'stickyNote.stack': { forma: 'fields' },

  'system.create': { forma: 'inverse' },
  'system.update': { forma: 'fields' },
  'system.remove': { forma: 'inverse' },

  'tag.remove': {
    forma: 'no',
    motivo: 'Borrar una etiqueta destruye la fila y sus enlaces de verdad; no queda de dónde traerla.',
  },

  'energy.applyWeeklyRitual': { forma: 'inverse' },
  'energy.applyCeiling': { forma: 'inverse' },
  'energy.updateProfile': { forma: 'inverse' },

  'log.deshacer': {
    forma: 'no',
    motivo: 'Deshacer un deshacer es rehacer, y eso es volver a pedir el cambio.',
  },
};

/** La acción que deja el propio deshacer. No se deshace: ver `DESHACER`. */
export const ACCION_DESHACER = 'log.deshacer';

/**
 * Las tablas cuyo borrado es blando. El `targetId` de un evento es texto a
 * propósito (el lector tolera un objetivo que ya no existe), así que aquí hay
 * un `as` por entrada y es el precio de esa decisión.
 */
type TablaBlanda = 'tasks' | 'pages' | 'folders' | 'stickyNotes';

const papelera =
  (borrar: boolean) =>
  async (ctx: MutationCtx, fila: Doc<'eventLog'>): Promise<string[]> => {
    const now = Date.now();
    const id = fila.targetId as Id<TablaBlanda>;
    await ctx.db.patch(id, borrar ? { deletedAt: now, updatedAt: now } : { deletedAt: undefined, updatedAt: now });
    return ['deletedAt'];
  };

/** Vuelve a poner (o a quitar) un enlace entre dos filas. */
async function enlaceTarea(ctx: MutationCtx, fila: Doc<'eventLog'>, poner: boolean): Promise<string[]> {
  const pageId = fila.targetId as Id<'pages'>;
  const taskId = fila.payload.taskId as Id<'tasks'>;
  const existente = await ctx.db
    .query('taskPageLinks')
    .withIndex('by_task_page', (q) => q.eq('taskId', taskId).eq('pageId', pageId))
    .unique();
  if (poner && !existente) await ctx.db.insert('taskPageLinks', { taskId, pageId });
  if (!poner && existente) await ctx.db.delete(existente._id);
  return ['taskPageLinks'];
}

async function etiquetaPagina(ctx: MutationCtx, fila: Doc<'eventLog'>, poner: boolean): Promise<string[]> {
  const pageId = fila.targetId as Id<'pages'>;
  const tagId = fila.payload.tagId as Id<'contextTags'>;
  const existente = await ctx.db
    .query('pageTags')
    .withIndex('by_page_tag', (q) => q.eq('pageId', pageId).eq('tagId', tagId))
    .unique();
  if (poner && !existente) await ctx.db.insert('pageTags', { pageId, tagId });
  if (!poner && existente) await ctx.db.delete(existente._id);
  return ['pageTags'];
}

/**
 * La operación contraria de cada acción que se deshace invirtiéndose. Devuelve
 * los campos que tocó, que es lo que la fila del log guarda en `undoneFields`.
 */
const INVERSOS: Record<string, (ctx: MutationCtx, fila: Doc<'eventLog'>) => Promise<string[]>> = {
  'task.create': papelera(true),
  'task.remove': papelera(false),
  'task.restore': papelera(true),
  'page.create': papelera(true),
  'page.remove': papelera(false),
  'page.restore': papelera(true),
  'folder.create': papelera(true),
  'folder.remove': papelera(false),
  'folder.restore': papelera(true),
  'stickyNote.create': papelera(true),
  'stickyNote.remove': papelera(false),
  'stickyNote.restore': papelera(true),

  'page.linkTask': (ctx, fila) => enlaceTarea(ctx, fila, false),
  'page.unlinkTask': (ctx, fila) => enlaceTarea(ctx, fila, true),
  'page.addTag': (ctx, fila) => etiquetaPagina(ctx, fila, false),
  'page.removeTag': (ctx, fila) => etiquetaPagina(ctx, fila, true),

  'system.create': async (ctx, fila) => {
    await ctx.db.patch(fila.targetId as Id<'systems'>, { isActive: false, updatedAt: Date.now() });
    return ['isActive'];
  },
  'system.remove': async (ctx, fila) => {
    await ctx.db.patch(fila.targetId as Id<'systems'>, { isActive: true, updatedAt: Date.now() });
    return ['isActive'];
  },

  // El reparto movió hasta cien tareas y su evento guarda la fecha que cada
  // una tenía. Reponerlas todas es el deshacer; una tarea que ya no existe se
  // salta, porque el resto sí se puede devolver.
  'energy.applyWeeklyRitual': async (ctx: MutationCtx, fila: Doc<'eventLog'>) => {
    const anterior = fila.payload.anterior as Array<{ taskId: string; startDate: string | null }> | undefined;
    if (!anterior) return [];
    const now = Date.now();
    for (const { taskId, startDate } of anterior) {
      const tarea = await ctx.db.get(taskId as Id<'tasks'>);
      if (!tarea || tarea.userId !== fila.userId) continue;
      await ctx.db.patch(tarea._id, { startDate: startDate === null ? undefined : Date.parse(startDate), updatedAt: now });
    }
    return ['startDate'];
  },

  'energy.applyCeiling': async (ctx, fila) => {
    const perfil = await ctx.db
      .query('userEnergyProfile')
      .withIndex('by_user', (q) => q.eq('userId', fila.userId))
      .unique();
    if (!perfil) return [];
    await ctx.db.patch(perfil._id, { availableHoursPerDay: fila.payload.anterior as number, updatedAt: Date.now() });
    return ['availableHoursPerDay'];
  },

  // Sólo los campos que aquel cambio tocó: el resto del perfil pudo moverse
  // después y devolverlo entero pisaría cambios que nadie pidió deshacer.
  'energy.updateProfile': async (ctx, fila) => {
    const perfil = await ctx.db
      .query('userEnergyProfile')
      .withIndex('by_user', (q) => q.eq('userId', fila.userId))
      .unique();
    if (!perfil) return [];
    const anterior = fila.payload.anterior;
    if (typeof anterior !== 'object' || anterior === null) return [];
    const campos = anterior as Record<string, unknown>;
    await ctx.db.patch(perfil._id, { ...campos, updatedAt: Date.now() });
    return Object.keys(campos);
  },
};

/**
 * Qué le puede ofrecer la pantalla a esta fila: la forma con la que se deshace,
 * o el motivo por el que no. Es la misma función que la mutación consulta, así
 * que un botón que se pinta es un botón que funciona.
 */
export function comoDeshacer(fila: Doc<'eventLog'>, userId: Id<'users'>): FormaDeDeshacer {
  const motivo = impedimento(fila, userId);
  return motivo === null ? DESHACER[fila.action]! : { forma: 'no', motivo };
}

/** Por qué un evento concreto no se puede deshacer ahora mismo, o `null`. */
function impedimento(fila: Doc<'eventLog'>, userId: Id<'users'>): string | null {
  if (fila.userId !== userId) return 'Ese cambio no es tuyo.';
  if (fila.undoneAt !== undefined) return 'Esto ya se deshizo.';
  const como = DESHACER[fila.action];
  if (!como) return 'Este cambio es de una versión anterior de Kino y no sabe deshacerse.';
  if (como.forma === 'no') return como.motivo;
  if (como.forma === 'fields' && Object.keys(fila.payload).length === 0) {
    return 'Ese cambio no dejó ningún campo que devolver.';
  }
  if (fila.payload.omitido === true) return 'El cambio fue más grande de lo que el registro guarda, así que no hay con qué volver.';
  if (como.forma === 'snapshot' && fila.snapshotId === undefined) {
    return 'La versión anterior del texto ya no se guarda: sólo sobreviven las quince últimas de cada capítulo.';
  }
  return null;
}

/**
 * Deshace un cambio, y **campo a campo, no la fila entera**: si entre la
 * escritura y el deshacer alguien tocó otro campo, ese otro campo se queda como
 * está. Revertir la fila entera destruiría trabajo que nadie pidió deshacer.
 *
 * Deja su propio evento, con la marca de a cuál deshace, y marca el original
 * como deshecho con los campos que devolvió. Las dos cosas: sin la marca en el
 * original la fila seguiría ofreciendo el botón, y sin evento propio un
 * deshacer sería la única escritura de Kino que no queda registrada.
 */
export const deshacer = kinoMutation({
  args: { id: v.id('eventLog') },
  handler: async (ctx, { id }) => {
    const fila = await ctx.db.get(id);
    if (!fila) notFound('Ese cambio ya no está en el registro.');
    const motivo = await deshacerUno(ctx, fila);
    return motivo === null ? { deshecho: true as const } : { deshecho: false as const, motivo };
  },
});

/**
 * Deshace una fila y deja su rastro, o devuelve el motivo por el que no.
 * Es el paso que comparten el botón de una fila y el deshacer en bloque: con
 * dos copias, el deshacer en bloque acabaría siendo el que se salta una regla.
 */
async function deshacerUno(
  ctx: MutationCtx & { clientId?: string; user: Doc<'users'>; channel: ActorChannel },
  fila: Doc<'eventLog'>,
): Promise<string | null> {
  const motivo = impedimento(fila, ctx.user._id);
  if (motivo !== null) return motivo;

  const campos = await revertir(ctx, fila, DESHACER[fila.action]!);
  if (campos === null) return 'Eso ya no existe.';

  await ctx.db.patch(fila._id, { undoneAt: Date.now(), undoneFields: campos });
  await recordEvent(ctx, {
    userId: ctx.user._id,
    systemId: fila.systemId,
    actorChannel: ctx.channel,
    action: ACCION_DESHACER,
    targetType: fila.targetType,
    targetId: fila.targetId,
    payload: { deshace: fila.action, campos },
  });
  return null;
}

/** Aplica la forma que le toca. `null` si el objetivo ya no existe. */
async function revertir(ctx: MutationCtx, fila: Doc<'eventLog'>, como: FormaDeDeshacer): Promise<string[] | null> {
  if (como.forma === 'inverse') return INVERSOS[fila.action]!(ctx, fila);

  // `fields` y `snapshot` escriben sobre el propio objetivo, así que tiene que
  // seguir ahí. El inverso no siempre: reponer un enlace borrado toca otra
  // tabla.
  const objetivo = await ctx.db.get(fila.targetId as Id<'tasks'>);
  if (!objetivo || objetivo.userId !== fila.userId) return null;

  // `null` en el payload es "no había valor", y en Convex eso es `undefined`.
  const parche: Record<string, unknown> = { updatedAt: Date.now() };
  const campos: string[] = [];
  for (const [campo, valor] of Object.entries(fila.payload)) {
    if (campo === 'contenidoCambiado') continue;
    parche[campo] = valor === null ? undefined : valor;
    campos.push(campo);
  }

  if (como.forma === 'snapshot') {
    const version = await ctx.db.get(fila.snapshotId!);
    if (!version) return null;
    parche.content = version.content;
    campos.push('content');
  }

  await ctx.db.patch(objetivo._id, parche);
  return campos;
}

// ── Lo que hizo tu agente hoy ───────────────────────────────────────────────

/**
 * El día natural de la persona en milisegundos. Se calcula aquí y no en el
 * navegador porque un reloj mal puesto en el cliente cambiaría la cifra que la
 * fila afirma, y la fila afirma cosas.
 */
function diaDe(user: Doc<'users'>, now = Date.now()) {
  const hoy = calendarDayInTz(now, user.timezone);
  // El día de ayer a la misma hora da el mismo texto salvo en la frontera, así
  // que el arranque se busca hacia atrás en pasos de una hora: es exacto con
  // cualquier desplazamiento, incluidos los de media hora.
  let desde = now;
  while (calendarDayInTz(desde - 3_600_000, user.timezone) === hoy) desde -= 3_600_000;
  while (calendarDayInTz(desde - 60_000, user.timezone) === hoy) desde -= 60_000;
  return { desde, hasta: now + 1 };
}

/**
 * Los eventos de hoy cuyo actor entró por el conector, agrupados por acción.
 *
 * Es la fila diaria de Hoy, y es **otra cosa** que la lista por item: aquélla
 * contesta «qué le pasó a esto», ésta contesta «qué hizo mientras no miraba».
 * Sin ella, la única forma de saberlo es abrir item por item.
 *
 * «Hoy» lo decide el servidor con la zona de la persona, no el reloj del
 * navegador: es la regla de la casa, y aquí importa el doble porque de esa
 * cuenta sale una cifra que la fila afirma.
 */
export const delAgenteHoy = kinoQuery({
  args: {},
  handler: async (ctx) => {
    const { desde, hasta } = diaDe(ctx.user);
    const filas = await ctx.db
      .query('eventLog')
      .withIndex('by_user_occurred', (q) => q.eq('userId', ctx.user._id).gte('occurredAt', desde).lt('occurredAt', hasta))
      .collect();

    // El propio deshacer no cuenta como actividad del agente: si contara, la
    // fila diría que hizo más cosas justo después de que las deshicieras.
    const suyos = filas.filter((fila) => fila.actorChannel === 'oauth' && fila.action !== ACCION_DESHACER && fila.undoneAt === undefined);
    if (suyos.length === 0) return null;

    const porAccion = new Map<string, number>();
    for (const fila of suyos) porAccion.set(fila.action, (porAccion.get(fila.action) ?? 0) + 1);

    const sistemas = new Set<Id<'systems'>>();
    for (const fila of suyos) if (fila.systemId) sistemas.add(fila.systemId);
    const nombres: string[] = [];
    for (const systemId of sistemas) {
      const sistema = await ctx.db.get(systemId);
      if (sistema) nombres.push(sistema.name);
    }

    return {
      total: suyos.length,
      // Lo más hecho primero: la frase empieza por lo que más pesa.
      acciones: [...porAccion.entries()]
        .map(([action, cuantas]) => ({ action, cuantas }))
        .sort((a, b) => b.cuantas - a.cuantas || a.action.localeCompare(b.action)),
      sistemas: nombres.sort(),
      ids: suyos.sort((a, b) => b.occurredAt - a.occurredAt).map((fila) => fila._id),
    };
  },
});

/**
 * Deshace de golpe lo que el agente hizo en un rango, y **deja un evento de
 * deshacer por cada acción**.
 *
 * Un deshacer en bloque que no se pueda auditar acción por acción es
 * exactamente la clase de escritura opaca que el log existe para evitar: por
 * eso no hay un atajo, se recorre la lista y cada una pasa por su propia forma.
 * Lo que no se pueda deshacer se cuenta aparte en vez de fallar entero: que una
 * de las cinco no vuelva no es razón para que las otras cuatro tampoco.
 */
export const deshacerDelAgente = kinoMutation({
  args: {},
  handler: async (ctx) => {
    const { desde, hasta } = diaDe(ctx.user);
    const filas = await ctx.db
      .query('eventLog')
      .withIndex('by_user_occurred', (q) => q.eq('userId', ctx.user._id).gte('occurredAt', desde).lt('occurredAt', hasta))
      .collect();

    // De la más nueva a la más vieja: deshacer una creación antes que la
    // edición que vino después dejaría la edición sobre una fila en la papelera.
    const suyos = filas
      .filter((fila) => fila.actorChannel === 'oauth' && fila.action !== ACCION_DESHACER && fila.undoneAt === undefined)
      .sort((a, b) => b.occurredAt - a.occurredAt);

    let deshechas = 0;
    const sinDeshacer: string[] = [];
    for (const fila of suyos) {
      const resultado = await deshacerUno(ctx, fila);
      if (resultado === null) deshechas += 1;
      else sinDeshacer.push(resultado);
    }
    return { deshechas, sinDeshacer };
  },
});

// ── La lectura por item ─────────────────────────────────────────────────────

/**
 * Tope de eventos por respuesta. Treinta días de retención sobre un item que
 * alguien edita a diario caben de sobra en cien, y `restantes` lo dice cuando
 * no: es el mismo trato que `TASK_LIST_LIMIT`.
 */
export const EVENT_LIST_LIMIT = 100;

/** Si el lector alcanza el sistema de un evento ajeno, por membresía. */
async function alcanzaSistema(ctx: QueryCtx, userId: Id<'users'>, systemId: Id<'systems'> | undefined) {
  if (!systemId) return false;
  const membresia = await ctx.db
    .query('systemMembers')
    .withIndex('by_system_user', (q) => q.eq('systemId', systemId).eq('userId', userId))
    .unique();
  return membresia !== null;
}

/**
 * Lo que le ha pasado a un item: quién, por qué vía y cuándo, lo más reciente
 * primero.
 *
 * Es la lista **por item**, la que se abre desde el propio item. La fila diaria
 * de lo que hizo tu agente es otra cosa y vive en Hoy.
 */
export const porItem = kinoQuery({
  args: { targetType: itemType, targetId: v.string() },
  handler: async (ctx, { targetType, targetId }) => {
    const filas = await ctx.db
      .query('eventLog')
      .withIndex('by_target', (q) => q.eq('targetType', targetType).eq('targetId', targetId))
      .order('desc')
      .collect();

    const visibles: Doc<'eventLog'>[] = [];
    for (const fila of filas) {
      if (fila.userId === ctx.user._id || (await alcanzaSistema(ctx, ctx.user._id, fila.systemId))) visibles.push(fila);
    }

    return {
      items: visibles.slice(0, EVENT_LIST_LIMIT).map((fila) => ({
        id: fila._id,
        action: fila.action,
        actor: actorDe(fila, ctx.user),
        occurredAt: new Date(fila.occurredAt).toISOString(),
        undoneAt: fila.undoneAt === undefined ? null : new Date(fila.undoneAt).toISOString(),
        undoneFields: fila.undoneFields ?? null,
        // Que la escritura salió de una propuesta que el usuario aceptó, sin
        // exponer la propuesta: el item no es sitio para abrirla.
        desdePropuesta: fila.proposalId !== undefined,
        // Si la fila pinta botón o motivo. Se decide en el servidor porque el
        // motivo depende de cosas que el cliente no ve: si la versión del
        // texto sobrevivió, si el payload se recortó, si ya se deshizo.
        deshacer: comoDeshacer(fila, ctx.user._id),
      })),
      restantes: Math.max(0, visibles.length - EVENT_LIST_LIMIT),
    };
  },
});

/**
 * Borra los eventos de más de treinta días, hasta PRUNE_BATCH por ejecución.
 * Si llenó el lote quedan más viejos, y se reprograma para seguir; si no, ha
 * terminado. Reejecutarla sobre una tabla ya podada no borra nada.
 */
export const podar = internalMutation({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, { limite }) => {
    const tope = limite ?? PRUNE_BATCH;
    const corte = Date.now() - RETENTION_DAYS * 86_400_000;
    const viejos = await ctx.db
      .query('eventLog')
      .withIndex('by_occurred', (q) => q.lt('occurredAt', corte))
      .take(tope);
    for (const doc of viejos) await ctx.db.delete(doc._id);

    const quedan = viejos.length === tope;
    if (quedan) await ctx.scheduler.runAfter(0, internal.eventLog.podar, { limite: tope });
    return { borradas: viejos.length, quedan };
  },
});
