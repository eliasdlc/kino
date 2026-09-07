import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { DIGEST_BYTES_MAX, digestBytes, digestSchema } from './digests';

// Las rutas HTTP del deployment. Hoy hay una: la entrada del diario de
// sesiones.
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

const http = httpRouter();
http.route({ path: '/digests', method: 'POST', handler: uploadDigest });

export default http;
