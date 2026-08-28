import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MCP_SERVER_VERSION } from './version.js';

/**
 * Lo que anuncia el servidor y lo que se publica en npm tienen que ser lo mismo.
 * Es el olvido que ya ocurrió una vez, y desde fuera no se nota: un cliente que
 * recibe una versión que no existe no falla, sólo miente.
 */
describe('la versión del MCP', () => {
  it('es la que se publica en npm', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'),
    ) as { version: string };

    expect(MCP_SERVER_VERSION).toBe(manifest.version);
  });
});
