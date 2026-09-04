import { clerkClient } from '@clerk/nextjs/server';
import { NotFoundError, ValidationError } from '@/shared/utils/error';
import { getImageStorage } from '@/features/uploads/image-storage';
import { deleteAllUserImages } from '@/features/uploads/image-sweep';
import { deleteUserRow, selectUserAccount } from './account.queries';

export interface AccountOverview {
  name: string;
  email: string;
}

export async function getAccountOverview(userId: string): Promise<AccountOverview> {
  const user = await selectUserAccount(userId);
  if (!user) throw new NotFoundError('Cuenta no encontrada');
  return user;
}

/**
 * Borra la cuenta entera. El orden importa:
 *
 * 1. Las imágenes del Blob, que no caen por cascada y son lo único que vive
 *    fuera de la base. Si esto falla no se ha tocado nada más y se puede
 *    reintentar.
 * 2. La identidad en Clerk, que cierra todas sus sesiones. Sin ella nadie
 *    puede volver a entrar a una cuenta a medio borrar.
 * 3. La fila de `users`; el resto cae en cascada.
 */
export async function deleteAccount(input: {
  userId: string;
  clerkId: string;
  /** El correo escrito por la persona como confirmación, ya normalizado. */
  confirmation: string;
}): Promise<void> {
  const user = await selectUserAccount(input.userId);
  if (!user) throw new NotFoundError('Cuenta no encontrada');
  if (input.confirmation !== user.email.toLowerCase()) {
    throw new ValidationError('El correo no coincide con el de tu cuenta');
  }

  const storage = getImageStorage();
  if (storage) await deleteAllUserImages(storage, input.userId);

  await (await clerkClient()).users.deleteUser(input.clerkId);
  await deleteUserRow(input.userId);
}
