import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderMobile } from '@/shared/testing/render';
import { ChronotypeAsk } from './ChronotypeAsk';

/**
 * La otra mitad de la decisión del alta: el alta sacó el cronotipo del camino de
 * entrada porque un perfil declarado el día 1 es una suposición, y esto es el
 * "después, cuando haya datos que lo justifiquen".
 */

describe('ChronotypeAsk', () => {
  it('pregunta con la curva medida delante, no con una suposición', () => {
    renderMobile(
      <ChronotypeAsk
        medicion={{ medido: 'evening', declarado: 'morning', dias: 14, pico: { start: 18, end: 20 } }}
      />,
    );

    expect(screen.getByText('Tu pico está entre las 18 y las 20')).toBeInTheDocument();
    expect(screen.getByText(/medido sobre 14 días/)).toBeInTheDocument();
  });

  it('nombra los dos cronotipos en la voz del producto, no con su clave', () => {
    renderMobile(
      <ChronotypeAsk
        medicion={{ medido: 'evening', declarado: 'morning', dias: 14, pico: { start: 18, end: 20 } }}
      />,
    );

    expect(screen.getByText(/Eso es de noche, y tienes puesto de mañana/)).toBeInTheDocument();
  });

  it('no revienta con un cronotipo que no conoce', () => {
    renderMobile(
      <ChronotypeAsk
        medicion={{ medido: 'raro', declarado: 'intermediate', dias: 14, pico: { start: 9, end: 11 } }}
      />,
    );

    expect(screen.getByText(/Eso es raro, y tienes puesto mixto/)).toBeInTheDocument();
  });
});
