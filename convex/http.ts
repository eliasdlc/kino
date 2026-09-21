import { httpRouter } from 'convex/server';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { academicoSchema } from './academico';
import { DIGEST_BYTES_MAX, digestBytes, digestSchema } from './digests';
import { clerkUserCreatedSchema, correoPrimario, nombreDe } from './users';

// Las rutas HTTP del deployment. Hoy hay tres: la entrada del diario de
// sesiones, la de lo que publica el aula virtual, y el webhook con el que
// Clerk avisa de una cuenta nueva.
//
// Las dos entran por aquí y no por una ruta de Next por la misma razón: cada
// deployment de Convex se empareja con una instancia de Clerk, así que la URL
// es estable y no cambia con cada preview de Vercel, la credencial vive en el
// mismo sitio que la base a la que escribe, y la escritura no depende de que
// el despliegue de Next esté arriba.
//
// Por qué el digest no entra por el conector del MCP. `digests.record` es una
// escritura directa, y en el conector eso significa que **cualquier** token con
// alcance `write` podría fabricar la línea del lunes. La línea del lunes cita
// una sesión real de Elias y es el criterio de muerte del diario: una cita
// fabricada no se distingue de una verdadera después. Así que la operación vive
// fuera de la superficie del agente, detrás de una credencial propia del hook
// que ningún cliente OAuth tiene, y no aparece en `catalog.ts` ni como tool ni
// bajo ningún nombre.

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Compara dos secretos sin decir por dónde dejan de parecerse. La diferencia
 * de longitud sí se filtra, y da igual: lo que no puede filtrarse es el
 * prefijo, que es lo que permite adivinar un token carácter a carácter.
 */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const bearer = (request: Request) => {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
};

/**
 * La entrada del diario.
 *
 * La credencial es de perfil propio en el sentido literal: el deployment dice
 * con `KINO_DIGEST_TOKEN` cuál es el secreto del hook y con
 * `KINO_DIGEST_EMAIL` de quién son los digests que escribe. El cuerpo no elige
 * la cuenta, así que el secreto no sirve para escribir en otra, y quitar la
 * variable corta la subida sin tocar nada más.
 *
 * 201 la primera vez, 200 en un reintento del mismo digest, 400 si no valida o
 * se pasa del tope, 403 con cualquier otra credencial.
 */
const uploadDigest = httpAction(async (ctx, request) => {
  const secret = process.env.KINO_DIGEST_TOKEN;
  const email = process.env.KINO_DIGEST_EMAIL;
  // Sin las dos variables la ruta no está configurada, y una ruta abierta por
  // no estar configurada es peor que una que no responde.
  if (!secret || !email) return json(503, { error: 'DIGEST_UPLOAD_NOT_CONFIGURED' });

  const token = bearer(request);
  if (!token || !sameSecret(token, secret)) return json(403, { error: 'FORBIDDEN' });

  const parsed = digestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'VALIDATION_ERROR', issues: parsed.error.issues });

  const bytes = digestBytes(parsed.data.digest);
  if (bytes > DIGEST_BYTES_MAX) return json(400, { error: 'DIGEST_TOO_LARGE', bytes, max: DIGEST_BYTES_MAX });

  const user = await ctx.runQuery(internal.digests.userByEmail, { email });
  if (!user) return json(503, { error: 'DIGEST_USER_NOT_FOUND' });

  const result = await ctx.runMutation(internal.digests.record, {
    userId: user._id,
    source: parsed.data.source,
    externalId: parsed.data.externalId,
    digest: parsed.data.digest,
  });
  return json(result.created ? 201 : 200, result);
});

/**
 * La entrada de lo que publica el aula virtual.
 *
 * Misma forma que el diario y por las mismas razones: credencial propia del
 * barrido en `KINO_ACADEMICO_TOKEN`, cuenta fijada por el deployment en
 * `KINO_ACADEMICO_EMAIL`, y sin las dos la ruta no existe en vez de quedar
 * abierta. El cuerpo no elige la cuenta.
 *
 * Lo que cambia respecto al diario es adónde escribe: esto crea tareas, no
 * filas de un registro. Por eso responde 503 cuando no encuentra un sistema
 * académico en vez de dejarlas en el Inbox: un barrido que escribe en el sitio
 * equivocado y devuelve 200 es un barrido que nadie va a ir a revisar.
 *
 * 200 siempre que escribió algo o confirmó que no había nada que escribir, con
 * el desglose dentro, porque el barrido corre cada seis horas y lo normal es
 * que no haya nada nuevo.
 */
const ingestaAcademica = httpAction(async (ctx, request) => {
  const secret = process.env.KINO_ACADEMICO_TOKEN;
  const email = process.env.KINO_ACADEMICO_EMAIL;
  if (!secret || !email) return json(503, { error: 'ACADEMICO_NOT_CONFIGURED' });

  const token = bearer(request);
  if (!token || !sameSecret(token, secret)) return json(403, { error: 'FORBIDDEN' });

  const parsed = academicoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'VALIDATION_ERROR', issues: parsed.error.issues });

  const user = await ctx.runQuery(internal.digests.userByEmail, { email });
  if (!user) return json(503, { error: 'ACADEMICO_USER_NOT_FOUND' });

  const systemId = await ctx.runQuery(internal.academico.destino, { userId: user._id });
  if (!systemId) return json(503, { error: 'ACADEMICO_SYSTEM_NOT_FOUND' });

  const result = await ctx.runMutation(internal.academico.sincronizar, {
    userId: user._id,
    systemId,
    items: parsed.data.items,
  });
  return json(200, result);
});

/**
 * La cuenta nueva.
 *
 * Es el sitio donde nace la fila de `users` en el caso normal, y existe para
 * que no tenga que nacer en el camino de render: antes, `getServerSession`
 * esperaba una escritura en Convex antes de cada página para garantizar lo que
 * este webhook garantiza una sola vez, cuando Clerk crea la cuenta.
 *
 * **No es el único garante, y no puede serlo.** Clerk entrega el evento en
 * paralelo al redirect del navegador, así que hay una ventana en la que la
 * persona llega antes que su fila. Quien la cubre es `src/proxy.ts`, que llama
 * a `users.ensure` una vez por navegador. Este webhook es lo que hace que ese
 * suelo casi nunca escriba nada, y lo que cubre las cuentas que Clerk crea sin
 * que nadie abra un navegador (una invitación desde su panel).
 *
 * La firma la comprueba Clerk con su propio verificador contra
 * `CLERK_WEBHOOK_SIGNING_SECRET`, que es por instancia y se carga en el
 * deployment con `npx convex env set`. Sin la variable la ruta responde 503 en
 * vez de aceptar cualquier cuerpo.
 */
const clerkUserCreated = httpAction(async (ctx, request) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  // Sin el secreto la ruta no está configurada, y una ruta abierta por no
  // estar configurada es peor que una que no responde.
  if (!secret) return json(503, { error: 'CLERK_WEBHOOK_NOT_CONFIGURED' });

  let evento: unknown;
  try {
    evento = await verifyWebhook(request, { signingSecret: secret });
  } catch {
    return json(400, { error: 'BAD_SIGNATURE' });
  }

  // Clerk manda al endpoint todos los eventos a los que esté suscrito y sólo
  // `user.created` nos incumbe. Un 4xx haría que lo reintentara durante días,
  // así que lo que no encaja se reconoce y se tira. La firma ya demostró que
  // viene de Clerk: un cuerpo que no encaja es otro evento, no un intento de
  // colarse.
  const parsed = clerkUserCreatedSchema.safeParse(evento);
  if (!parsed.success) return json(200, { ignored: true });

  // Kino identifica a una persona por su correo, y un registro sólo por
  // teléfono no trae ninguno. Reintentarlo no haría aparecer uno.
  const email = correoPrimario(parsed.data.data);
  if (!email) return json(200, { ignored: true, reason: 'SIN_CORREO' });

  const userId = await ctx.runMutation(internal.users.fromClerk, {
    clerkId: parsed.data.data.id,
    email,
    name: nombreDe(parsed.data.data),
    image: parsed.data.data.image_url ?? undefined,
  });
  return json(200, { userId });
});

const http = httpRouter();
http.route({ path: '/digests', method: 'POST', handler: uploadDigest });
http.route({ path: '/academico', method: 'POST', handler: ingestaAcademica });
http.route({ path: '/clerk/user-created', method: 'POST', handler: clerkUserCreated });

export default http;
