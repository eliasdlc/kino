import { APIError } from 'better-auth/api';
import { auth } from '@/auth';
import { NotFoundError, ValidationError } from '@/shared/utils/error';
import { getImageStorage } from '@/features/uploads/image-storage';
import { deleteAllUserImages } from '@/features/uploads/image-sweep';
import {
  deleteSessionById,
  deleteSessionsExcept,
  deleteUserRow,
  selectActiveSessions,
  selectSignInMethods,
  selectUserAccount,
  updateUserName,
} from './account.queries';
import { describeUserAgent, type DeviceDescription } from './user-agent';
import type { ChangePasswordInput } from './account.schemas';

/** A qué pantalla vuelve el enlace de confirmación del correo nuevo. */
const EMAIL_CHANGE_CALLBACK = '/settings?email=confirmed';

export interface AccountOverview {
  name: string;
  email: string;
  emailVerified: boolean;
  /** Sin contraseña (sólo Google o GitHub) no hay contraseña que cambiar. */
  hasPassword: boolean;
  /** Proveedores OAuth con los que entra: `google`, `github`. */
  providers: string[];
}

export async function getAccountOverview(userId: string): Promise<AccountOverview> {
  const [user, methods] = await Promise.all([selectUserAccount(userId), selectSignInMethods(userId)]);
  if (!user) throw new NotFoundError('Cuenta no encontrada');
  return {
    ...user,
    hasPassword: methods.some((m) => m.providerId === 'credential' && m.hasPassword),
    providers: methods.filter((m) => m.providerId !== 'credential').map((m) => m.providerId),
  };
}

export async function renameAccount(userId: string, name: string): Promise<AccountOverview> {
  await updateUserName(userId, name);
  return getAccountOverview(userId);
}

/**
 * Better Auth responde con códigos suyos; aquí se traducen a errores de
 * dominio con un mensaje para la persona. Lo que no se reconoce sigue su
 * camino como 500, que es lo que es.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PASSWORD: 'La contraseña actual no es correcta',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Esta cuenta entra con Google o GitHub y no tiene contraseña',
  PASSWORD_TOO_SHORT: 'La contraseña nueva necesita al menos 8 caracteres',
  PASSWORD_TOO_LONG: 'La contraseña nueva no puede pasar de 128 caracteres',
};

function translateAuthError(error: unknown): unknown {
  if (!(error instanceof APIError)) return error;
  const code = error.body?.code;
  if (typeof code === 'string' && code in AUTH_ERROR_MESSAGES) {
    return new ValidationError(AUTH_ERROR_MESSAGES[code]);
  }
  if (error.body?.message === 'Email is the same') {
    return new ValidationError('Ese ya es el correo de tu cuenta');
  }
  return error;
}

/**
 * Cambia la contraseña comprobando la actual y cierra las demás sesiones: si
 * se cambia es porque la anterior se filtró o se compartió, y una sesión
 * abierta con ella no debe sobrevivir. La sesión actual se renueva; las
 * cabeceras devueltas llevan la cookie nueva y hay que reenviarlas.
 */
export async function changePassword(headers: Headers, input: ChangePasswordInput): Promise<Headers> {
  try {
    const result = await auth.api.changePassword({
      body: { ...input, revokeOtherSessions: true },
      headers,
      returnHeaders: true,
    });
    return result.headers;
  } catch (error) {
    throw translateAuthError(error);
  }
}

/**
 * Pide el cambio de correo: Better Auth manda el enlace a la dirección nueva
 * y el cambio se aplica cuando lo confirma. Si la dirección ya es de otra
 * cuenta responde igual que si no lo fuera, para no revelar quién está
 * registrado.
 */
export async function requestEmailChange(headers: Headers, newEmail: string): Promise<void> {
  try {
    await auth.api.changeEmail({ body: { newEmail, callbackURL: EMAIL_CHANGE_CALLBACK }, headers });
  } catch (error) {
    throw translateAuthError(error);
  }
}

export interface ActiveSession {
  id: string;
  /** La sesión desde la que se está mirando la lista. */
  current: boolean;
  device: DeviceDescription;
  ipAddress: string | null;
  createdAt: Date;
  lastActiveAt: Date;
}

export async function listActiveSessions(userId: string, currentSessionId: string): Promise<ActiveSession[]> {
  const rows = await selectActiveSessions(userId);
  return rows.map((row) => ({
    id: row.id,
    current: row.id === currentSessionId,
    device: describeUserAgent(row.userAgent),
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
    lastActiveAt: row.updatedAt,
  }));
}

export async function revokeSession(userId: string, sessionId: string, currentSessionId: string) {
  if (sessionId === currentSessionId) {
    throw new ValidationError('Para cerrar esta sesión usa «Cerrar sesión»');
  }
  const deleted = await deleteSessionById(userId, sessionId);
  if (!deleted) throw new NotFoundError('Esa sesión ya no existe');
}

export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  return deleteSessionsExcept(userId, currentSessionId);
}

/**
 * Borra la cuenta entera. El orden importa:
 *
 * 1. Las imágenes del Blob, que no caen por cascada y son lo único que vive
 *    fuera de Postgres. Si esto falla no se ha tocado nada más y se puede
 *    reintentar.
 * 2. Cerrar la sesión actual, que es lo que produce las cabeceras que borran
 *    la cookie. Después de la fila ya no habría sesión que cerrar.
 * 3. La fila de `users`; el resto cae en cascada.
 *
 * Los tokens OAuth del MCP que ya estén emitidos siguen firmando bien hasta
 * caducar, pero apuntan a un usuario que ya no existe y cualquier lectura
 * responde vacío o falla por clave foránea.
 */
export async function deleteAccount(input: {
  userId: string;
  /** El correo escrito por la persona como confirmación, ya normalizado. */
  confirmation: string;
  headers: Headers;
}): Promise<Headers> {
  const user = await selectUserAccount(input.userId);
  if (!user) throw new NotFoundError('Cuenta no encontrada');
  if (input.confirmation !== user.email.toLowerCase()) {
    throw new ValidationError('El correo no coincide con el de tu cuenta');
  }

  const storage = getImageStorage();
  if (storage) await deleteAllUserImages(storage, input.userId);

  const { headers } = await auth.api.signOut({ headers: input.headers, returnHeaders: true });
  await deleteUserRow(input.userId);
  return headers;
}
