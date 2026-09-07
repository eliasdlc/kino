// Lo que nunca sale del disco de Elias.
//
// Un digest que se sube con una clave dentro no se puede des-subir, así que
// esta lista va en el mismo pase que el extractor y nunca después.
//
// Los patrones no son genéricos: son los que **este** proyecto produce de
// verdad. El runbook de `AGENTS.md` (Restaurar un respaldo) hace escribir en
// una transcripción cuatro `export` de credenciales, una clave de deploy de
// Convex y la ruta de la identidad `age`; el trabajo con Clerk deja claves
// `sk_live_`; y las transcripciones viejas todavía llevan cadenas de Postgres.
//
// Cada patrón exige **el valor y no sólo el nombre**. Una lista por prefijos
// bloquearía este mismo comentario, y una que bloquea de más se desactiva en la
// segunda semana.

export interface Patron {
  /** Cómo se llama en la salida del hook. Nunca se imprime el secreto. */
  readonly nombre: string;
  readonly re: RegExp;
}

export const PATRONES: readonly Patron[] = [
  { nombre: 'credencial de R2 o AWS', re: /\bAWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)\s*=\s*["']?[A-Za-z0-9/+=_-]{8,}/ },
  { nombre: 'clave de deploy de Convex', re: /\bCONVEX_(?:PROD_)?(?:DEPLOY|ADMIN)_KEY\s*=\s*["']?(?:prod|dev):\S/ },
  { nombre: 'identidad age del respaldo', re: /\bAGE_IDENTITY_FILE\s*=\s*\S/ },
  { nombre: 'clave secreta de Clerk', re: /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/ },
  { nombre: 'cadena de Postgres con contraseña', re: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/ },
  { nombre: 'bloque de clave privada', re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { nombre: 'token de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { nombre: 'clave age', re: /\bAGE-SECRET-KEY-1[A-Z0-9]{20,}|\bage1[a-z0-9]{25,}/ },
];

/**
 * El nombre del patrón que bloquea este texto, o `null` si está limpio. Devuelve
 * el nombre y no la coincidencia a propósito: lo que el hook imprime cuando
 * bloquea es por qué bloqueó, jamás qué encontró.
 */
export function bloqueaPor(texto: string): string | null {
  for (const patron of PATRONES) {
    if (patron.re.test(texto)) return patron.nombre;
  }
  return null;
}

/** Atajo legible para el extractor, que descarta antes de elegir la cita. */
export const estaLimpio = (texto: string): boolean => bloqueaPor(texto) === null;
