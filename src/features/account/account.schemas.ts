import { z } from 'zod';

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1, 'El nombre no puede estar vacío').max(100),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * Los límites son los de Better Auth (8 a 128). Validar aquí también da un 400
 * con detalle de campo en vez del error opaco del proveedor.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: z
    .string()
    .min(8, 'La contraseña nueva necesita al menos 8 caracteres')
    .max(128, 'La contraseña nueva no puede pasar de 128 caracteres'),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const normalizedEmail = z.string().trim().toLowerCase();

export const changeEmailSchema = z.object({
  newEmail: normalizedEmail.pipe(z.email('Escribe un correo válido')),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

/** El correo escrito a mano como confirmación; se compara con el de la cuenta. */
export const deleteAccountSchema = z.object({
  email: normalizedEmail,
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
