import { z } from 'zod';

/** El correo escrito a mano como confirmación; se compara con el de la cuenta. */
export const deleteAccountSchema = z.object({
  email: z.string().trim().toLowerCase(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
