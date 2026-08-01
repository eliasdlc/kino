import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { users } from "@/shared/db/schema";

/**
 * Timezone del usuario, con `UTC` como respaldo. Vive junto a `shared/time`
 * porque es el otro medio input de todo cálculo de día local: el módulo hermano
 * sabe convertir "hoy" a una tz, este sabe *cuál* tz. Separado de `index.ts` a
 * propósito: ese es puro y viaja al cliente, este toca la DB.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.timezone ?? "UTC";
}
