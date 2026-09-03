/**
 * Lee, sin verificar la firma, a qué dirección quiere cambiar un token de
 * verificación de Better Auth. El mismo hook de envío recibe el token del alta
 * y el del cambio de correo; la diferencia está en el payload (`updateTo`).
 *
 * Aquí no se decide nada de seguridad con el token, sólo qué plantilla enviar:
 * la firma la comprueba Better Auth cuando el enlace vuelve.
 */
export function emailChangeTarget(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const updateTo = (parsed as { updateTo?: unknown }).updateTo;
    return typeof updateTo === "string" && updateTo.length > 0 ? updateTo : null;
  } catch {
    return null;
  }
}
