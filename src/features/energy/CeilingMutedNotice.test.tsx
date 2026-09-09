import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { CeilingMutedNotice } from './CeilingMutedNotice';

/**
 * El único momento donde Kino pierde en público. Lo que se prueba es que la
 * cifra va antes que nada y que las catorce mediciones están, cada una con su
 * fila y ninguna apuntando a un dato que no existe.
 */

const DIAS = 14;

const CONFESION = {
  mutedAt: '2026-09-08T00:00:00.000Z',
  errorMedio: 31,
  dias: DIAS,
  umbral: 25,
  predicciones: Array.from({ length: DIAS }, (_, i) => ({
    date: `2026-08-${String(i + 20).padStart(2, '0')}`,
    slot: 'morning',
    predicted: 50,
    reported: 19,
    error: 31,
  })),
};

function cliente(value: typeof CONFESION | null) {
  return makeTestConvexClient([stubQuery(api.energy.ceilingHonesty, value)]);
}

describe('CeilingMutedNotice', () => {
  it('con el techo encendido no hay nada que confesar', () => {
    renderMobile(<CeilingMutedNotice />, { convex: cliente(null) });

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('la cifra va delante de todo, con los días encima de los que se midió', () => {
    renderMobile(<CeilingMutedNotice />, { convex: cliente(CONFESION) });

    expect(
      screen.getByRole('heading', { name: 'Me equivoqué 31 puntos al día, 14 días seguidos.' }),
    ).toBeInTheDocument();
  });

  it('dice qué deja de hacer, y qué sigue haciendo', () => {
    renderMobile(<CeilingMutedNotice />, { convex: cliente(CONFESION) });

    expect(screen.getByText(/Sigo midiendo el día, pero dejo de opinar/)).toBeInTheDocument();
  });

  it('las catorce están, y ninguna es un control muerto', () => {
    renderMobile(<CeilingMutedNotice />, { convex: cliente(CONFESION) });

    const celdas = screen.getAllByRole('button');
    expect(celdas).toHaveLength(DIAS);
    // Catorce destinos de un toque en 393 px: cada uno en el mínimo de 48.
    for (const celda of celdas) expect(celda.className).toContain('h-12');
  });

  it('cada una señala su fila: su día, lo que dije y lo que registraste', async () => {
    const user = userEvent.setup();
    renderMobile(<CeilingMutedNotice />, { convex: cliente(CONFESION) });

    await user.click(screen.getAllByRole('button')[0]!);

    expect(screen.getByText(/2026-08-20: dije 50 y registraste 19/)).toBeInTheDocument();
    expect(screen.getByText('31 de error.')).toBeInTheDocument();
  });

  it('sin error medido no se afirma nada', () => {
    renderMobile(<CeilingMutedNotice />, {
      convex: cliente({ ...CONFESION, errorMedio: null as unknown as number, predicciones: [] }),
    });

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});
