import { describe, expect, it } from 'vitest';
import { readCallback } from './setup';

/**
 * El nonce del asistente de configuración (KIN-162).
 *
 * El token vuelve al servidor efímero de loopback como parámetro de la URL. Sin
 * nonce, una página cualquiera que acierte el puerto puede llamar a `/callback`
 * con *su* token, y el agente acaba escribiendo en la cuenta de otro. Lo que se
 * afirma aquí es que sólo una respuesta con el `state` exacto devuelve un token,
 * porque escribir `~/.claude.json` cuelga de eso.
 */

const STATE = 'HsQ2mF7kx9Lb0aZpV3nT8wYc1RdG5jEu4MoI6sN7qKA';
const PORT = 51234;

function callback(query: string) {
  return readCallback(`/callback${query}`, PORT, STATE);
}

describe('readCallback', () => {
  it('acepta el callback que trae el state de este setup', () => {
    const outcome = callback(`?token=sk-kino-abc&state=${STATE}`);
    expect(outcome).toEqual({ kind: 'accepted', token: 'sk-kino-abc' });
  });

  it('rechaza un state ajeno, y no devuelve token', () => {
    const outcome = callback('?token=sk-kino-del-atacante&state=otro-state-cualquiera');
    expect(outcome.kind).toBe('rejected');
    expect(JSON.stringify(outcome)).not.toContain('sk-kino');
  });

  it('rechaza el callback sin state, que es el flujo viejo', () => {
    expect(callback('?token=sk-kino-abc').kind).toBe('rejected');
  });

  it('rechaza un state que sólo comparte el prefijo', () => {
    expect(callback(`?token=sk-kino-abc&state=${STATE.slice(0, -1)}`).kind).toBe('rejected');
  });

  it('rechaza un state más largo que el esperado', () => {
    expect(callback(`?token=sk-kino-abc&state=${STATE}x`).kind).toBe('rejected');
  });

  it('comprueba el state antes que el token: un callback ajeno se corta igual', () => {
    const outcome = callback('?state=otro');
    expect(outcome).toMatchObject({ kind: 'rejected', status: 403 });
  });

  it('pide el token cuando el state sí cuadra', () => {
    expect(callback(`?state=${STATE}`)).toMatchObject({ kind: 'rejected', status: 400 });
  });

  it('ignora cualquier otra ruta sin tumbar el servidor', () => {
    expect(readCallback('/', PORT, STATE)).toEqual({ kind: 'ignored' });
    expect(readCallback('/favicon.ico', PORT, STATE)).toEqual({ kind: 'ignored' });
    expect(readCallback(undefined, PORT, STATE)).toEqual({ kind: 'ignored' });
  });
});
