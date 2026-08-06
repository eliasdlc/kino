import { getImageStorage } from "./image-storage";
import { getReferencedImageUrls, getAllUserIds } from "./uploads.queries";
import { sweepUserImages, type SweepBudget, type SweepResult } from "./image-sweep";

/**
 * Barre las imágenes huérfanas de un usuario. `null` cuando no hay store
 * configurado — sin backend no hay nada que barrer, y no es un error.
 */
export async function sweepOrphanImagesForUser(
  userId: string,
  budget?: Partial<SweepBudget>,
): Promise<SweepResult | null> {
  const storage = getImageStorage();
  if (!storage) return null;

  // Se leen las referencias **antes** de listar el store. Al revés, una imagen
  // subida entre el listado y la lectura contaría como huérfana sin serlo.
  const referenced = await getReferencedImageUrls(userId);

  return sweepUserImages({ userId, storage, referenced, budget });
}

export interface SweepAllResult {
  users: number;
  deleted: number;
  freedBytes: number;
  /** Quedaron usuarios sin barrer, o alguno a medias: repetir en la siguiente vuelta. */
  incomplete: boolean;
  /**
   * Usuarios cuyo barrido se frenó por resultado increíble. Distinto de `incomplete`:
   * esto no se arregla repitiendo, hay que mirarlo.
   */
  aborted: number;
}

/**
 * Barrido de todos los usuarios, para el cron. Reparte un plazo global entre ellos
 * y para en seco al agotarse: lo que quede huérfano seguirá huérfano mañana, así que
 * dejarlo a medias no pierde nada.
 */
export async function sweepOrphanImagesForAllUsers(input?: {
  deadlineMs?: number;
  now?: () => number;
}): Promise<SweepAllResult> {
  const deadlineMs = input?.deadlineMs ?? 7_000;
  const now = input?.now ?? Date.now;
  const started = now();

  const storage = getImageStorage();
  if (!storage) return { users: 0, deleted: 0, freedBytes: 0, incomplete: false, aborted: 0 };

  const userIds = await getAllUserIds();
  const result: SweepAllResult = {
    users: 0,
    deleted: 0,
    freedBytes: 0,
    incomplete: false,
    aborted: 0,
  };

  for (const userId of userIds) {
    if (now() - started >= deadlineMs) {
      result.incomplete = true;
      break;
    }
    // Un usuario que falle no debe llevarse por delante el barrido de los demás.
    try {
      const referenced = await getReferencedImageUrls(userId);
      const swept = await sweepUserImages({
        userId,
        storage,
        referenced,
        budget: { deadlineMs: Math.max(0, deadlineMs - (now() - started)) },
        now,
      });
      result.deleted += swept.deleted;
      result.freedBytes += swept.freedBytes;
      if (swept.incomplete) result.incomplete = true;
      if (swept.aborted) result.aborted += 1;
    } catch {
      result.incomplete = true;
    }
    result.users += 1;
  }

  if (result.users < userIds.length) result.incomplete = true;

  return result;
}
