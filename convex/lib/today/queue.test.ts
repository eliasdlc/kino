/**
 * La cola de una sola interrupción al día, par a par. Es la primera vez que el
 * principio 8 se aplica en código, así que lo que se prueba es que el orden no
 * dependa del orden de llegada y que nada se quede delante para siempre.
 */
import { describe, expect, it } from 'vitest';
import type { InterruptionKind } from '../../schema';
import { comparar, DIAS_ANTES_DE_CEDER, laInterrupcion, ORDEN_TERCERA, type Candidato } from './queue';

const MS_POR_DIA = 86_400_000;
const AHORA = 1_757_000_000_000;

/** Las siete clases, en el orden en que la cola tiene que devolverlas. */
const ESPERADO: InterruptionKind[] = ['lunes', 'autoArchivo', ...ORDEN_TERCERA, 'empujeSistema'];

const candidato = (kind: InterruptionKind, extra: Partial<Candidato> = {}): Candidato => ({
  kind,
  key: `${kind}-1`,
  payload: {},
  ...extra,
});

describe('la cola de una sola interrupción', () => {
  it('devuelve como mucho un elemento, y ninguno cuando no hay candidatos', () => {
    expect(laInterrupcion([], AHORA)).toBeNull();
    const uno = laInterrupcion(ESPERADO.map((kind) => candidato(kind)), AHORA);
    expect(uno?.kind).toBe('lunes');
  });

  it('todos los pares de las siete clases respetan el orden, venga como venga', () => {
    for (let i = 0; i < ESPERADO.length; i++) {
      for (let j = 0; j < ESPERADO.length; j++) {
        if (i === j) continue;
        const gana = ESPERADO[Math.min(i, j)];
        const par = [candidato(ESPERADO[i]), candidato(ESPERADO[j])];
        expect(laInterrupcion(par, AHORA)?.kind, `${ESPERADO[i]} contra ${ESPERADO[j]}`).toBe(gana);
        // Y al revés, para que el resultado no venga del orden de llegada.
        expect(laInterrupcion([...par].reverse(), AHORA)?.kind).toBe(gana);
      }
    }
  });

  it('la tercera prioridad sigue D-26: el techo va delante del ritual y de las propuestas del agente', () => {
    expect(ORDEN_TERCERA).toEqual(['techo', 'cronotipo', 'ritual', 'agente']);
    const tercera = ORDEN_TERCERA.map((kind) => candidato(kind));
    expect(laInterrupcion(tercera, AHORA)?.kind).toBe('techo');
    expect([...tercera].sort(comparar).map((c) => c.kind)).toEqual([...ORDEN_TERCERA]);
  });

  it('el empuje de Bandeja no es una clase de la cola', () => {
    // La regla del principio 7: ocho items en Bandeja proponen agrupar, pero
    // eso es una fila de estado sin pregunta y no gasta la apertura del día.
    // Si alguna vez entra aquí, esta lista deja de coincidir.
    expect(ESPERADO).not.toContain('bandeja');
    expect(ESPERADO).toHaveLength(7);
  });

  it('una interrupción mostrada hace dos días sin acuse cede el turno a la siguiente', () => {
    const viejo = candidato('lunes', { surfacedAt: AHORA - (DIAS_ANTES_DE_CEDER * MS_POR_DIA + 1) });
    const nuevo = candidato('agente');
    expect(laInterrupcion([viejo, nuevo], AHORA)?.kind).toBe('agente');

    // Justo dentro de la ventana sigue delante: la regla es "más de dos días".
    const reciente = candidato('lunes', { surfacedAt: AHORA - DIAS_ANTES_DE_CEDER * MS_POR_DIA });
    expect(laInterrupcion([reciente, nuevo], AHORA)?.kind).toBe('lunes');
  });

  it('un candidato acusado no vuelve, y si era el único no se pinta nada', () => {
    const acusado = candidato('ritual', { surfacedAt: AHORA - 1000, acknowledgedAt: AHORA - 500 });
    expect(laInterrupcion([acusado], AHORA)).toBeNull();
    expect(laInterrupcion([acusado, candidato('empujeSistema')], AHORA)?.kind).toBe('empujeSistema');
  });

  it('a igual clase gana el que lleva más tiempo esperando, y el que nunca se mostró va detrás', () => {
    const antiguo = candidato('agente', { key: 'a', surfacedAt: AHORA - 3600_000 });
    const reciente = candidato('agente', { key: 'b', surfacedAt: AHORA - 60_000 });
    const nuevo = candidato('agente', { key: 'c' });
    expect(laInterrupcion([nuevo, reciente, antiguo], AHORA)?.key).toBe('a');
  });
});
