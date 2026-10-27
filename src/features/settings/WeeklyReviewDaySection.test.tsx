/**
 * Criterio: el día de la revisión es un grupo de radios de verdad. Tiene una
 * sola parada de tabulación, las flechas mueven el foco y eligen sin cerrar
 * la hoja, y elegir con un toque guarda y cierra. Tocar el día ya elegido
 * cierra sin escribir.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation, stubMutationPending, stubQuery } from '@/shared/testing/render';
import { WeeklyReviewDaySection } from './WeeklyReviewDaySection';
import { AJUSTES_DE_PRUEBA } from './settings-fixtures';

const cliente = () =>
  makeTestConvexClient([stubQuery(api.settings.get, AJUSTES_DE_PRUEBA)], [stubMutation(api.settings.update, AJUSTES_DE_PRUEBA)]);

describe('WeeklyReviewDaySection', () => {
  it('una sola parada de tabulación, en el día elegido', () => {
    renderWithProviders(<WeeklyReviewDaySection />, { convex: cliente() });

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(7);
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([screen.getByRole('radio', { name: 'Domingo' })]);
  });

  it('las flechas mueven el foco y eligen, sin cerrar la hoja', async () => {
    // La escritura queda en vuelo: lo marcado es lo elegido, no lo que la cuenta decía.
    const enVuelo = stubMutationPending(api.settings.update);
    const convex = makeTestConvexClient([stubQuery(api.settings.get, AJUSTES_DE_PRUEBA)], [enVuelo.stub]);
    const onChosen = vi.fn();
    renderWithProviders(<WeeklyReviewDaySection onChosen={onChosen} />, { convex });

    screen.getByRole('radio', { name: 'Domingo' }).focus();
    await userEvent.keyboard('{ArrowDown}');

    const siguiente = screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')!;
    expect(siguiente).not.toHaveAccessibleName('Domingo');
    expect(siguiente).toHaveFocus();
    expect(onChosen).not.toHaveBeenCalled();
    await waitFor(() => expect(convex.calls).toHaveLength(1));
  });

  it('tocar un día lo guarda y cierra; tocar el elegido cierra sin escribir', async () => {
    const convex = cliente();
    const onChosen = vi.fn();
    renderWithProviders(<WeeklyReviewDaySection onChosen={onChosen} />, { convex });

    await userEvent.click(screen.getByRole('radio', { name: 'Domingo' }));
    expect(onChosen).toHaveBeenCalledTimes(1);
    expect(convex.calls).toEqual([]);

    await userEvent.click(screen.getByRole('radio', { name: 'Lunes' }));
    expect(onChosen).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(convex.calls).toEqual([{ kind: 'mutation', name: 'settings:update', args: { weeklyReviewDay: 'mon' } }]),
    );
  });
});
