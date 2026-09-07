/**
 * Qué se prueba: que **toda** función pública de Convex declara hasta dónde
 * llega un agente en ella, y que el catálogo del MCP no publica ninguna que no
 * deba publicar.
 *
 * Este test es la única forma honesta de contar las funciones y de saber cómo
 * están repartidas, así que imprime la cuenta. El tipo generado de `api.*` no
 * conserva la marca del alcance, de modo que la comprobación no la puede hacer
 * el compilador: o está aquí, o no está en ningún sitio.
 */

import { describe, expect, it } from 'vitest';
import { getFunctionName } from 'convex/server';
import { reachOf } from './lib/fn';
import { REACHES, type Reach } from './lib/scopes';
import { CATALOG } from '../src/features/mcp/tools/catalog';
import { LEARNING_TOOLS } from '../src/features/mcp/tools/learning';

// Perezoso y con exclusiones: `convex.config` sólo corre dentro del runtime de
// Convex y revienta al importarlo aquí, y ni `schema` ni `crons` exportan
// funciones públicas.
const modulos = import.meta.glob('./*.ts');

/** Módulos que no publican funciones y que además no se pueden cargar aquí. */
const FUERA = ['schema', 'crons', 'convex.config', 'auth.config'];

/**
 * Lo que Convex publica de un módulo de la raíz de `convex/`. Una función
 * registrada es una función con las marcas que le pone el registrador, y
 * `isPublic` es la que distingue una operación del usuario de una interna
 * (crons, importador), que nadie llama con identidad.
 */
type Registrada = { isQuery?: boolean; isMutation?: boolean; isAction?: boolean; isPublic?: boolean };

function esFuncionPublica(valor: unknown): boolean {
  if (typeof valor !== 'function') return false;
  const fn = valor as unknown as Registrada;
  return fn.isPublic === true && (fn.isQuery === true || fn.isMutation === true || fn.isAction === true);
}

const publicas = (
  await Promise.all(
    Object.entries(modulos).map(async ([ruta, cargar]) => {
      const nombreModulo = ruta.replace(/^\.\//, '').replace(/\.ts$/, '');
      // El glob es perezoso, así que descartar antes de llamar al cargador es
      // lo que evita importar `convex.config`, que sólo corre dentro del
      // runtime de Convex y revienta fuera de él.
      if (FUERA.includes(nombreModulo) || nombreModulo.endsWith('.test')) return [];
      const modulo = (await cargar()) as Record<string, unknown>;
      return Object.entries(modulo)
        .filter(([, valor]) => esFuncionPublica(valor))
        .map(([nombre, valor]) => ({ nombre: `${nombreModulo}:${nombre}`, reach: reachOf(valor) }));
    }),
  )
).flat();

/** El alcance de cada función pública, por su nombre completo. */
const porNombre = new Map(publicas.map((f) => [f.nombre, f.reach]));

describe('el alcance de las funciones públicas', () => {
  it('todas lo declaran', () => {
    const sinAlcance = publicas.filter((f) => f.reach === undefined).map((f) => f.nombre);

    const reparto = Object.fromEntries(
      REACHES.map((reach) => [reach, publicas.filter((f) => f.reach === reach).length] as const),
    ) as Record<Reach, number>;
    console.log(`funciones públicas: ${publicas.length}`, reparto);

    expect(sinAlcance).toEqual([]);
    expect(publicas.length).toBeGreaterThan(100);
  });

  it('hay al menos una cerrada, o el alcance cerrado sería decorativo', () => {
    expect(publicas.filter((f) => f.reach === 'closed').map((f) => f.nombre)).not.toEqual([]);
  });
});

const publicadas = [...CATALOG, ...LEARNING_TOOLS];

describe('el catálogo del MCP', () => {
  it('cada tool apunta a una función pública, salvo las secuencias de aprendizaje', () => {
    const sinFuncion = publicadas.filter((tool) => tool.ref === undefined).map((t) => t.name);
    expect(sinFuncion).toEqual([
      'create_learning_session',
      'get_learning_session',
      'save_learning_checkpoint',
      'append_learning_interaction',
      'park_learning_thought',
    ]);

    for (const tool of publicadas) {
      if (!tool.ref) continue;
      const nombre = getFunctionName(tool.ref);
      expect(porNombre.has(nombre), `${tool.name} apunta a ${nombre}, que no es una función pública`).toBe(true);
    }
  });

  it('ninguna tool publica una función cerrada', () => {
    const cerradas = publicadas
      .filter((tool) => tool.ref !== undefined && porNombre.get(getFunctionName(tool.ref)) === 'closed')
      .map((t) => t.name);
    expect(cerradas).toEqual([]);
  });
});
