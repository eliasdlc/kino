/**
 * Criterio: el límite diario se sube y se baja de cinco en cinco con un toque
 * por paso, cada toque se ve en el acto, y lo que se escribe en la cuenta es
 * el último valor cuando los toques paran: tres toques seguidos son una sola
 * escritura, sin botón Guardar. Los pasos caen en la rejilla de cinco: un
 * valor fuera de ella vuelve a la rejilla en el primer toque.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from '@/shared/testing/render';
import { EnergyLimitRow } from './EnergyLimitRow';
import { ESPERA_GUARDADO_MS } from './use-borrador';
import { AJUSTES_DE_PRUEBA } from './settings-fixtures';

describe('EnergyLimitRow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tres toques se ven al instante y se guardan una vez, con el último valor', async () => {
    const convex = makeTestConvexClient(
      [stubQuery(api.settings.get, AJUSTES_DE_PRUEBA)],
      [stubMutation(api.settings.update, AJUSTES_DE_PRUEBA)],
    );
    renderWithProviders(<EnergyLimitRow />, { convex });

    const mas = screen.getByRole('button', { name: 'Sumar 5 puntos' });
    fireEvent.click(mas);
    fireEvent.click(mas);
    fireEvent.click(mas);
    expect(screen.getByRole('status')).toHaveTextContent('65');
    expect(convex.calls).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(ESPERA_GUARDADO_MS);
    });
    expect(convex.calls).toEqual([{ kind: 'mutation', name: 'settings:update', args: { dailyEnergyLimit: 65 } }]);
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
  });

  it('el grupo del stepper se llama como su fila', () => {
    renderWithProviders(<EnergyLimitRow />, { convex: makeTestConvexClient([stubQuery(api.settings.get, AJUSTES_DE_PRUEBA)]) });
    expect(screen.getByRole('group', { name: 'Límite diario' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('50');
  });

  it('un valor fuera de la rejilla de cinco vuelve a ella en el primer toque', () => {
    renderWithProviders(<EnergyLimitRow />, {
      convex: makeTestConvexClient([stubQuery(api.settings.get, { ...AJUSTES_DE_PRUEBA, dailyEnergyLimit: 47 })]),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sumar 5 puntos' }));
    expect(screen.getByRole('status')).toHaveTextContent('50');
    fireEvent.click(screen.getByRole('button', { name: 'Restar 5 puntos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restar 5 puntos' }));
    expect(screen.getByRole('status')).toHaveTextContent('40');
  });

  it('desde el mínimo, un paso arriba cae en el primer múltiplo de cinco', () => {
    renderWithProviders(<EnergyLimitRow />, {
      convex: makeTestConvexClient([stubQuery(api.settings.get, { ...AJUSTES_DE_PRUEBA, dailyEnergyLimit: 1 })]),
    });

    expect(screen.getByRole('button', { name: 'Restar 5 puntos' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sumar 5 puntos' }));
    expect(screen.getByRole('status')).toHaveTextContent(/^5$/);
  });
});
