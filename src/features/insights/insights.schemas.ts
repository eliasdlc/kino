import { z } from 'zod';

/**
 * Los parámetros de ventana temporal se **acotan**, no se rechazan: un `days`
 * fuera de rango o ilegible cae al default en vez de devolver 400. Es el
 * comportamiento que tenían estas rutas a mano y del que dependen los hooks,
 * que construyen la URL sin validar.
 */
function daysQuery(fallback: number, max: number) {
  return z.object({
    days: z.coerce.number().int().min(1).max(max).catch(fallback),
  });
}

export const energyDistributionQuerySchema = daysQuery(7, 90);
export const staleSystemsQuerySchema = daysQuery(14, 180);

export const suggestQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).catch(10),
});

export const classifyTaskSchema = z.object({
  title: z.string().trim().min(1),
  // Una description que no sea string se ignora en vez de tumbar la petición:
  // el contrato con los tools del MCP siempre ha sido tolerante aquí.
  description: z.string().optional().catch(undefined),
});

export const estimateTaskSchema = classifyTaskSchema;

export const decomposeSchema = z.object({
  // Se valida como uuid para que un id mal formado sea un 400 y no el 500 que
  // devolvería Postgres al fallar el cast.
  taskId: z.uuid(),
  count: z.number().finite().optional(),
});
