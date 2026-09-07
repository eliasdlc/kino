/**
 * Qué se prueba: que la denylist bloquea los ocho secretos que este proyecto
 * produce de verdad, y que no bloquea el texto que habla de ellos. Las dos
 * mitades importan igual: una lista que bloquea de más se desactiva en la
 * segunda semana, y entonces deja de bloquear nada.
 */
import { describe, expect, it } from 'vitest';
import { bloqueaPor, estaLimpio, PATRONES } from './denylist';

const BLOQUEAN: ReadonlyArray<readonly [string, string]> = [
  ['export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEX', 'credencial de R2 o AWS'],
  ['export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE', 'credencial de R2 o AWS'],
  ["export CONVEX_DEPLOY_KEY='prod:judicious-marmot-297|eyJ2MiI6', ya está", 'clave de deploy de Convex'],
  ['export AGE_IDENTITY_FILE=~/.config/kino/backup-age.key', 'identidad age del respaldo'],
  ['CLERK_SECRET_KEY=sk_live_9aB3xQ7zLmNp2R', 'clave secreta de Clerk'],
  ['DATABASE_URL=postgresql://kino:sup3rs3cr3t@ep-cool.neon.tech/db', 'cadena de Postgres con contraseña'],
  ['-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA', 'bloque de clave privada'],
  ['el token es ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6', 'token de GitHub'],
  ['AGE-SECRET-KEY-1QQPQZRPQ9WERTYUIOPASDFGHJKLZXCVBNM', 'clave age'],
];

/** Los mismos nombres, en el texto que este repo escribe todos los días. */
const NO_BLOQUEAN = [
  'la denylist tiene que cubrir AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY',
  'la clave de deploy de producción empieza por prod: y lleva un CONVEX_DEPLOY_KEY delante',
  'poner AGE_IDENTITY_FILE apuntando a la clave del gestor de contraseñas',
  'las claves de Clerk son sk_live_ en producción y sk_test_ en desarrollo',
  'en local la base es postgresql://localhost:5432/kino, sin contraseña',
  'el fichero arranca con -----BEGIN y hay que leerlo entero',
  'un token de GitHub empieza por ghp_ y uno de OAuth por gho_',
  'la recipient pública del respaldo es un age1 y la privada no está en ningún servicio',
];

describe('la denylist del diario', () => {
  it.each(BLOQUEAN)('bloquea %s', (texto, esperado) => {
    expect(bloqueaPor(texto)).toBe(esperado);
    expect(estaLimpio(texto)).toBe(false);
  });

  it.each(NO_BLOQUEAN)('no bloquea el texto que sólo lo nombra: %s', (texto) => {
    expect(bloqueaPor(texto)).toBeNull();
  });

  it('cada patrón declarado tiene al menos un caso que lo dispara', () => {
    const disparados = new Set(BLOQUEAN.map(([, nombre]) => nombre));
    expect([...PATRONES].map((p) => p.nombre).filter((n) => !disparados.has(n))).toEqual([]);
  });

  it('el motivo que devuelve no lleva el secreto dentro', () => {
    const motivo = bloqueaPor('export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEX')!;
    expect(motivo).not.toContain('wJalr');
    expect(PATRONES.map((p) => p.nombre)).toContain(motivo);
  });
});
