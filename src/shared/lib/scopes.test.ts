import { describe, expect, it } from 'vitest';
import { allowsScope, KINO_READ, KINO_WRITE, OWNER, type AuthScopes } from './scopes';

function oauth(...granted: string[]): AuthScopes {
  return { kind: 'oauth', granted };
}

describe('allowsScope · credenciales del dueño', () => {
  it('una cookie de sesión o una API key personal pueden todo', () => {
    expect(allowsScope(OWNER, KINO_READ)).toBe(true);
    expect(allowsScope(OWNER, KINO_WRITE)).toBe(true);
  });
});

describe('allowsScope · tokens OAuth acotados', () => {
  it('kino:read lee pero no escribe', () => {
    expect(allowsScope(oauth('openid', KINO_READ), KINO_READ)).toBe(true);
    expect(allowsScope(oauth('openid', KINO_READ), KINO_WRITE)).toBe(false);
  });

  it('kino:write implica kino:read: quien escribe, lee', () => {
    expect(allowsScope(oauth(KINO_WRITE), KINO_READ)).toBe(true);
    expect(allowsScope(oauth(KINO_WRITE), KINO_WRITE)).toBe(true);
  });

  it('pedir los dos también vale', () => {
    expect(allowsScope(oauth(KINO_READ, KINO_WRITE), KINO_WRITE)).toBe(true);
  });
});

describe('allowsScope · compatibilidad con los tokens ya emitidos', () => {
  // Esta es la regresión que importa: si un token vivo dejara de escribir el
  // día del deploy, la conexión MCP de Claude se rompería sin aviso.
  it('un token de sólo OIDC sigue escribiendo, porque es anterior a los scopes', () => {
    const legacy = oauth('openid', 'profile', 'email', 'offline_access');
    expect(allowsScope(legacy, KINO_READ)).toBe(true);
    expect(allowsScope(legacy, KINO_WRITE)).toBe(true);
  });

  it('un token sin ningún scope tampoco se rompe', () => {
    expect(allowsScope(oauth(), KINO_WRITE)).toBe(true);
  });

  // Y esta es la otra mitad: la cortesía se acaba en cuanto el token declara
  // uno de los dos, así que la regla se apaga sola conforme rotan los tokens.
  it('en cuanto el token pide kino:read, deja de tener barra libre', () => {
    expect(allowsScope(oauth('openid', 'profile', KINO_READ), KINO_WRITE)).toBe(false);
  });
});
