/**
 * Criterio: la zona horaria dice la ciudad de la cuenta. Si coincide con la
 * del dispositivo la fila sólo informa y no abre nada; si no, dice las dos y
 * abre una hoja que deja usar la de aquí, que guarda y cierra. Nunca cambia
 * sola.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from '@/shared/testing/render';
import { TimezoneRow } from './TimezoneRow';
import { AJUSTES_DE_PRUEBA } from './settings-fixtures';

/** El dispositivo dice estar en esta zona. */
function dispositivoEn(timeZone: string) {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...real.call(this), timeZone };
  });
}

const cliente = () =>
  makeTestConvexClient([stubQuery(api.settings.get, AJUSTES_DE_PRUEBA)], [stubMutation(api.settings.update, AJUSTES_DE_PRUEBA)]);

afterEach(() => vi.restoreAllMocks());

describe('TimezoneRow', () => {
  it('si coincide con el dispositivo sólo informa', () => {
    dispositivoEn('America/Santo_Domingo');
    const convex = cliente();
    renderWithProviders(<TimezoneRow />, { convex });

    expect(screen.getByText('Santo Domingo, la de aquí')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(convex.calls).toEqual([]);
  });

  it('si no coincide dice las dos, y usar la de aquí guarda y cierra', async () => {
    dispositivoEn('Europe/Madrid');
    const convex = cliente();
    renderWithProviders(<TimezoneRow />, { convex });

    expect(convex.calls).toEqual([]);
    const fila = screen.getByRole('button', { name: /Zona horaria/ });
    expect(fila).toHaveTextContent('Santo Domingo; aquí, Madrid');
    await userEvent.click(fila);

    await userEvent.click(await screen.findByRole('button', { name: 'Usar la de este dispositivo' }));

    expect(convex.calls).toEqual([{ kind: 'mutation', name: 'settings:update', args: { timezone: 'Europe/Madrid' } }]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zona horaria' })).not.toBeInTheDocument());
  });
});
