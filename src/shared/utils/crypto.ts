import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico para secretos de terceros que la app necesita **reutilizar**
 * en claro: hoy, el access token de GitHub en `sync_connections` (KIN-135).
 *
 * Por qué cifrado y no hash: un token de GitHub se compara (`github.ts`
 * hashea con SHA-256 y nunca lo recupera), pero un access token hay que
 * presentarlo íntegro a GitHub en cada llamada. Hashearlo lo haría inservible.
 *
 * AES-256-GCM y no CBC: GCM autentica además de cifrar, así que un ciphertext
 * manipulado falla al descifrar en vez de devolver basura que el código trataría
 * como un token válido.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96 bits, el tamaño recomendado para GCM
const AUTH_TAG_BYTES = 16;
const ENV_VAR = "ENCRYPTION_KEY";

export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionKeyError";
  }
}

/**
 * La clave se lee en cada llamada, no al cargar el módulo: en serverless el
 * módulo puede evaluarse antes de que el entorno esté completo, y una constante
 * de nivel superior convertiría una variable ausente en un fallo de importación
 * que tumba rutas que no tienen nada que ver con esto.
 */
function readKey(): Buffer {
  const raw = process.env[ENV_VAR];
  if (!raw) {
    throw new EncryptionKeyError(
      `Falta ${ENV_VAR}. Generar con: openssl rand -base64 32`,
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new EncryptionKeyError(
      `${ENV_VAR} debe ser de ${KEY_BYTES} bytes en base64; tiene ${key.length}.`,
    );
  }
  return key;
}

/** ¿Está el entorno listo para cifrar? Para degradar con un mensaje claro. */
export function isEncryptionConfigured(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve `iv.authTag.ciphertext`, los tres en base64url y separados por punto.
 * Todo lo necesario para descifrar viaja con el dato salvo la clave, así que
 * rotar el formato más adelante no obliga a adivinar cómo se cifró cada fila.
 */
export function encryptSecret(plaintext: string): string {
  const key = readKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Lanza si el texto está manipulado, truncado, o cifrado con otra clave. Nunca
 * devuelve un valor parcial: para quien llama, o sale el secreto original o sale
 * una excepción.
 */
export function decryptSecret(payload: string): string {
  const key = readKey();
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new EncryptionKeyError("Secreto cifrado con formato inválido.");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(dataB64, "base64url");

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new EncryptionKeyError("Secreto cifrado con formato inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
