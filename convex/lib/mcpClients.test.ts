/**
 * Qué se prueba: que `clienteConocido` convierte el `clientInfo.name` que cada
 * cliente manda en el protocolo en la pestaña y la etiqueta de Ajustes >
 * Agentes, y que ningún texto que Kino pinta lleva «Codex» a solas.
 *
 * Los nombres de abajo son los que se pudieron comprobar. Dos salen de un
 * cliente real y dos siguen sin captura: si Claude o ChatGPT mandan otro
 * nombre, esos clientes aparecen como `otro` hasta que se pegue aquí el real.
 */

import { describe, expect, it } from 'vitest';
import { clienteConocido, type ClienteConocido } from './mcpClients';

export const CASOS: { fuente: string; name: string; esperado: ClienteConocido }[] = [
  {
    // Codex CLI 0.164.0, captura en vivo: `initialize` con protocolVersion
    // 2025-06-18 y clientInfo {"name":"codex-mcp-client","title":"Codex","version":"0.164.0"}.
    // Las peticiones siguientes no llevan clientInfo en `params._meta` y su
    // User-Agent es "codex-mcp-client/0.164.0".
    fuente: 'Codex CLI 0.164.0, captura en vivo',
    name: 'codex-mcp-client',
    esperado: { kind: 'codex', label: 'Codex de OpenAI' },
  },
  {
    // Claude Code: clientInfo {"name":"claude-code","title":"Claude Code"}, leído
    // del binario instalado, no de una captura en vivo.
    fuente: 'Claude Code, leído de su binario',
    name: 'claude-code',
    esperado: { kind: 'claude-code', label: 'Claude Code' },
  },
  {
    // sin captura: el nombre exacto que manda claude.ai es una suposición.
    fuente: 'claude.ai',
    name: 'claude-ai',
    esperado: { kind: 'claude', label: 'Claude (claude.ai)' },
  },
  {
    // sin captura: el nombre exacto que manda ChatGPT es una suposición.
    fuente: 'ChatGPT',
    name: 'openai-mcp',
    esperado: { kind: 'chatgpt', label: 'ChatGPT' },
  },
];

describe('clienteConocido', () => {
  it.each(CASOS)('$fuente: «$name» es $esperado.label', ({ name, esperado }) => {
    expect(clienteConocido(name)).toEqual(esperado);
  });

  it('lo que case con /codex/i es Codex de OpenAI, escrito como sea y aunque diga también openai', () => {
    for (const name of ['Codex', 'CODEX', 'openai-codex', 'codex_cli_rs', ' codex-mcp-client/0.164.0 ']) {
      expect(clienteConocido(name), name).toEqual({ kind: 'codex', label: 'Codex de OpenAI' });
    }
  });

  it('el nombre de Claude Code gana al de Claude a secas', () => {
    expect(clienteConocido('Claude Code').kind).toBe('claude-code');
    expect(clienteConocido('claude_code').kind).toBe('claude-code');
    expect(clienteConocido('claude-desktop').kind).toBe('claude');
  });

  it('un nombre que no conoce queda como otro, recortado y con tope de 60', () => {
    expect(clienteConocido('  Cursor  ')).toEqual({ kind: 'otro', label: 'Cursor' });
    const largo = clienteConocido('x'.repeat(200));
    expect(largo.kind).toBe('otro');
    expect(largo.label).toHaveLength(60);
  });

  it('sin nombre, o con uno en blanco, es un cliente sin nombre', () => {
    for (const name of [undefined, '', '   ']) {
      expect(clienteConocido(name), String(name)).toEqual({ kind: 'otro', label: 'Cliente sin nombre' });
    }
  });

  it('ninguna etiqueta dice Codex a solas ni asistente', () => {
    for (const { name } of CASOS) {
      const { label } = clienteConocido(name);
      expect(label.replace('Codex de OpenAI', '')).not.toMatch(/codex/i);
      expect(label).not.toMatch(/asistente/i);
    }
  });
});
