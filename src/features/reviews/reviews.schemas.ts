import { z } from "zod";
import { BODY_MAX } from "@convex/lib/reviews";

/**
 * Lo que la persona escribe en un hilo: una respuesta o una pregunta. El tope
 * es el mismo que valida el servidor, del mismo sitio.
 */
export const replySchema = z.object({
  body: z.string().trim().min(1).max(BODY_MAX),
});

export const askSchema = replySchema;
