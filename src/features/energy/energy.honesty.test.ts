import { describe, expect, it } from 'vitest';
import {
  APAGAR_POR_ENCIMA_DE,
  decisionDelTecho,
  DIAS_DE_ERROR,
  diasMedidos,
  errorMedio,
  VOLVER_POR_DEBAJO_DE,
  type PrediccionVerificada,
} from './energy.honesty';

/**
 * Los dos umbrales y la ventana, sin base delante. Lo que más importa es la
 * histéresis: con un solo umbral el techo parpadearía en días alternos, y un
 * instrumento que cambia de opinión cada mañana es peor que uno que se equivoca.
 */

/** `dias` días, un slot por día, cada uno errando `error` puntos. */
function medidas(dias: number, error: number): PrediccionVerificada[] {
  return Array.from({ length: dias }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    slot: 'morning',
    predicted: 50,
    reported: 50 - error,
  }));
}

describe('errorMedio', () => {
  it('no dice cero cuando no hay nada: cero sería decir que acertó siempre', () => {
    expect(errorMedio([])).toBeNull();
  });

  it('mide en puntos y sin signo: pasarse y quedarse corto cuestan igual', () => {
    expect(
      errorMedio([
        { date: '2026-09-01', slot: 'morning', predicted: 50, reported: 20 },
        { date: '2026-09-02', slot: 'morning', predicted: 50, reported: 80 },
      ]),
    ).toBe(30);
  });
});

describe('diasMedidos', () => {
  it('cuenta días, no predicciones: tres slots de un día son un día', () => {
    const unDia: PrediccionVerificada[] = ['morning', 'afternoon', 'evening'].map((slot) => ({
      date: '2026-09-01',
      slot,
      predicted: 50,
      reported: 10,
    }));
    expect(diasMedidos(unDia)).toBe(1);
  });
});

describe('decisionDelTecho', () => {
  it('con trece días no puede dispararse, por mal que vaya', () => {
    expect(decisionDelTecho(medidas(DIAS_DE_ERROR - 1, 40), false)).toBe('nada');
  });

  it('con catorce y el error por encima del umbral, apaga', () => {
    expect(decisionDelTecho(medidas(DIAS_DE_ERROR, APAGAR_POR_ENCIMA_DE + 1), false)).toBe('apagar');
  });

  it('justo en el umbral todavía no apaga: la regla es "por encima"', () => {
    expect(decisionDelTecho(medidas(DIAS_DE_ERROR, APAGAR_POR_ENCIMA_DE), false)).toBe('nada');
  });

  it('la vuelta se propone, nunca se aplica sola', () => {
    expect(decisionDelTecho(medidas(DIAS_DE_ERROR, VOLVER_POR_DEBAJO_DE - 1), true)).toBe(
      'proponerVuelta',
    );
  });

  it('entre los dos umbrales no pasa nada, que es toda la histéresis', () => {
    // Un error de 20 no apaga un techo encendido ni enciende uno apagado: sin
    // esta banda muerta, un error rondando los 25 parpadearía en días alternos.
    const entre = medidas(DIAS_DE_ERROR, 20);
    expect(decisionDelTecho(entre, false)).toBe('nada');
    expect(decisionDelTecho(entre, true)).toBe('nada');
  });

  it('un techo apagado que sigue midiendo mal se queda apagado', () => {
    expect(decisionDelTecho(medidas(DIAS_DE_ERROR, 40), true)).toBe('nada');
  });

  it('los dos umbrales no se tocan, o la histéresis sería decorativa', () => {
    expect(VOLVER_POR_DEBAJO_DE).toBeLessThan(APAGAR_POR_ENCIMA_DE);
  });
});
