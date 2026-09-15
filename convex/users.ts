import { v } from 'convex/values';
import { z } from 'zod';
import { internalMutation, internalQuery } from './_generated/server';
import schema from './schema';
import { ensureUser, kinoMutation, kinoQuery } from './lib/fn';
import { calendarDayInTz, userToday } from './lib/time';

// La identidad de Clerk llega en el JWT; el documento `users` es lo que Kino
// sabe de esa persona. El envoltorio de `lib/fn` es quien los une.

/** El documento `users` de quien llama. */
export const current = kinoQuery({
  args: {},
  handler: async (ctx) => ctx.user,
});

/**
 * Garantiza que la identidad tiene su documento y lo devuelve.
 *
 * Ya no corre en cada render: quien crea la fila en el caso normal es el
 * webhook `user.created` (`fromClerk`, más abajo). Esta mutación es el suelo
 * que cubre la ventana en la que el navegador llega antes que el webhook, y la
 * llama `src/proxy.ts` una vez por navegador, no por página. Encontrarse la
 * fila ya hecha es lo esperado, y entonces no escribe nada.
 */
export const ensure = kinoMutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => ctx.user._id,
});

/**
 * Marca la cuenta como vista hoy. El cliente la llama al montar el layout de
 * la app; escribe como mucho una vez por día natural del usuario, así que
 * abrir Kino veinte veces en una tarde es una sola escritura. Es el dato con
 * el que se sabe quién sigue usando la aplicación.
 */
export const touch = kinoMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const now = Date.now();
    const today = userToday(ctx.user.timezone, now);
    const last = ctx.user.lastActiveAt;
    if (last !== undefined && calendarDayInTz(last, ctx.user.timezone) === today) return false;
    // La visita que se va no se pierde: `today.returnNotice` mide contra ella
    // el hueco que la persona estuvo fuera, y si sólo guardáramos la última
    // ese hueco se borraría justo al entrar a mirarlo.
    await ctx.db.patch(ctx.user._id, { lastActiveAt: now, previousActiveAt: last });
    return true;
  },
});

/**
 * Un `user.created` de Clerk, en lo que Kino usa de él.
 *
 * El correo no viene suelto: Clerk manda la lista de direcciones y aparte cuál
 * de ellas es la primaria, así que hay que cruzarlas. Cuando la primaria no
 * viene marcada (pasa en los registros por proveedor social, donde la única
 * dirección llega ya verificada), vale la primera de la lista.
 *
 * `catchall` a propósito: el cuerpo real trae treinta campos más y ninguno nos
 * incumbe. Un campo nuevo de Clerk no puede tumbar la ruta.
 */
export const clerkUserCreatedSchema = z
  .object({
    type: z.literal('user.created'),
    data: z
      .object({
        id: z.string().min(1),
        email_addresses: z
          .array(z.object({ id: z.string(), email_address: z.string() }).catchall(z.unknown()))
          .default([]),
        primary_email_address_id: z.string().nullish(),
        first_name: z.string().nullish(),
        last_name: z.string().nullish(),
        image_url: z.string().nullish(),
      })
      .catchall(z.unknown()),
  })
  .catchall(z.unknown());

export type ClerkUserCreated = z.infer<typeof clerkUserCreatedSchema>;

/** El correo con el que se abre la cuenta, o nada si el evento no trae ninguno. */
export function correoPrimario(data: ClerkUserCreated['data']): string | undefined {
  const marcada = data.email_addresses.find((direccion) => direccion.id === data.primary_email_address_id);
  return (marcada ?? data.email_addresses[0])?.email_address;
}

/** El nombre que Clerk conoce, o nada si la persona no dio ninguno. */
export function nombreDe(data: ClerkUserCreated['data']): string | undefined {
  const nombre = [data.first_name, data.last_name].filter((parte) => parte).join(' ').trim();
  return nombre.length > 0 ? nombre : undefined;
}

/**
 * Crea la fila de alguien que acaba de nacer en Clerk. Interna: la única
 * entrada es la ruta HTTP del webhook, que es quien comprueba la firma antes
 * de llegar aquí.
 *
 * Es la misma `ensureUser` que usa cualquier mutación, así que enlaza a un
 * usuario importado por su correo en vez de duplicarlo, y reintentar el mismo
 * evento no crea una segunda fila. Clerk reintenta ante cualquier respuesta
 * que no sea 2xx, y esa idempotencia es lo que lo hace seguro.
 */
export const fromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  returns: v.id('users'),
  handler: async (ctx, { clerkId, email, name, image }) => {
    const user = await ensureUser(ctx.db, { subject: clerkId, email, name, pictureUrl: image });
    return user._id;
  },
});

/** Para las acciones, que no tienen base a mano y lo piden por aquí. */
export const byClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) =>
    ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
      .unique(),
});

/** Borra todo documento de cualquier tabla que pertenezca al usuario, y al final el usuario. */
export const purge = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[]) {
      if (table === 'users') continue;
      const docs = await ctx.db
        .query(table)
        .filter((q) => q.eq(q.field('userId'), userId))
        .collect();
      for (const doc of docs) await ctx.db.delete(doc._id);
    }
    await ctx.db.delete(userId);
  },
});
