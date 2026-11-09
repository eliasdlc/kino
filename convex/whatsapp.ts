import { v } from 'convex/values';
import { z } from 'zod';
import { internalMutation, internalQuery } from './_generated/server';
import { lematizar } from './lib/lemas';
import { recalcularAviso } from './lib/avisos';

// La entrada del resumen nocturno de WhatsApp. Un trabajo programado en
// agentbox lee el archivo de chats de Elias, extrae tareas con una doble
// comprobación de modelo y las sube aquí ya formadas; Kino no ve el chat.
//
// Entra por `convex/http.ts` y no por el conector del MCP por la misma razón
// que `/academico`: esto escribe tareas directamente, y en el conector
// cualquier token con alcance `write` podría fabricarlas. La credencial es
// propia del trabajo (`KINO_WHATSAPP_TOKEN`) y no existe como tool.
//
// **La idempotencia es la pieza central.** El trabajo reintenta cuando no
// recibe respuesta, así que el mismo item llega más de una vez. La identidad
// `(userId, 'whatsapp', externalId)` es lo que impide la segunda tarea, y lo
// que Elias hizo después manda: una tarea completada o borrada se cuenta como
// existente y no vuelve, porque la conversación sigue en el archivo.

/** Lo que firma una tarea nacida de un resumen de WhatsApp. */
export const WHATSAPP_SOURCE = 'whatsapp';

/** Cuántos items admite un envío; acota el trabajo de la mutación. */
export const WHATSAPP_ITEMS_MAX = 50;

const itemSchema = z.object({
  /** La identidad del item en el archivo. Estable entre reintentos. */
  externalId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(2_000).optional(),
  /** Fecha límite en epoch ms. */
  dueDate: z.number().int().positive().optional(),
  /** El chat de donde salió, para que la tarea diga de quién es. */
  chatName: z.string().max(200).optional(),
});

export const whatsappSchema = z.object({
  source: z.literal(WHATSAPP_SOURCE),
  items: z.array(itemSchema).min(1).max(WHATSAPP_ITEMS_MAX),
});

/**
 * La Bandeja de la persona, que es adonde cae lo que no dice a qué sistema
 * pertenece. Devuelve null si no la tiene (entre el registro y
 * `systems.setup`) o si está archivada; la ruta lo vuelve un 503 visible en
 * vez de inventar un destino.
 */
export const destino = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const bandeja = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', userId).eq('isInbox', true))
      .first();
    return bandeja && bandeja.isActive ? bandeja._id : null;
  },
});

/**
 * Escribe los items nuevos. Interna: la única entrada es la ruta HTTP, que
 * comprueba la credencial antes de llegar aquí.
 *
 * Un item que ya existe no se toca, ni siquiera para corregir el título: lo
 * que Elias editó, completó o borró manda. Devuelve los `externalId` en dos
 * listas para que quien llama marque su registro sólo con lo confirmado.
 */
export const ingerir = internalMutation({
  args: {
    userId: v.id('users'),
    systemId: v.id('systems'),
    items: v.array(
      v.object({
        externalId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        dueDate: v.optional(v.number()),
        chatName: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({ created: v.array(v.string()), existing: v.array(v.string()) }),
  handler: async (ctx, { userId, systemId, items }) => {
    const ahora = Date.now();
    const created: string[] = [];
    const existing: string[] = [];

    for (const [posicion, item] of items.entries()) {
      // Incluye las borradas y las completadas: `by_user_external` no filtra,
      // y es lo que se quiere. Dos items iguales en un mismo envío también
      // se ven entre sí, porque la mutación lee sus propias escrituras.
      const previa = await ctx.db
        .query('tasks')
        .withIndex('by_user_external', (q) =>
          q.eq('userId', userId).eq('externalSource', WHATSAPP_SOURCE).eq('externalId', item.externalId),
        )
        .first();
      if (previa) {
        existing.push(item.externalId);
        continue;
      }

      const nueva = await ctx.db.insert('tasks', {
        userId,
        systemId,
        title: item.title,
        description: item.description,
        // Nace en el backlog: existe y nadie la planificó. Es una captura
        // hecha tarea, no una decisión de Elias, y el ritual semanal decide.
        status: 'backlog',
        energyLevel: 'medium',
        priority: 'medium',
        taskType: 'task',
        dueDate: item.dueDate,
        externalSource: WHATSAPP_SOURCE,
        externalId: item.externalId,
        metadata: { chatName: item.chatName },
        sortIndex: ahora + posicion,
        inTodayPlan: false,
        notifiedBeforeDay: false,
        notifiedDueDay: false,
        reminderCount: 0,
        lemas: lematizar(item.title, item.description),
        // Se firma la vía y no el autor, igual que el aula: no la escribió él.
        createdBy: userId,
        createdVia: 'sync',
        createdAt: ahora,
        updatedAt: ahora,
      });
      await recalcularAviso(ctx, (await ctx.db.get(nueva))!);
      created.push(item.externalId);
    }

    return { created, existing };
  },
});
