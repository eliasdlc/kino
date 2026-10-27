/**
 * Criterio: borrar la cuenta sólo se puede después de escribir el correo de la
 * cuenta (sin importar mayúsculas), y lo que se manda es lo escrito. Mientras
 * el correo no coincide, el botón de borrar está apagado y nada sale.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { CUENTA_DE_PRUEBA } from '@/features/settings/settings-fixtures';
import { makeTestConvexClient, renderWithProviders, stubQuery } from '@/shared/testing/render';
import { useDeleteAccount } from './account.hooks';
import { DangerZoneSection, DeleteAccountBody } from './DangerZoneSection';

function Cuerpo() {
  const deleteAccount = useDeleteAccount();
  return <DeleteAccountBody email="prueba@usekino.dev" onClose={vi.fn()} deleteAccount={deleteAccount} enfocar={false} />;
}

describe('DeleteAccountBody', () => {
  it('no deja borrar hasta escribir el correo, y manda lo escrito', async () => {
    const convex = makeTestConvexClient();
    renderWithProviders(<Cuerpo />, { convex });

    const borrar = screen.getByRole('button', { name: 'Borrar mi cuenta' });
    const campo = screen.getByLabelText(/para confirmar/);
    expect(borrar).toBeDisabled();

    await userEvent.type(campo, 'otra@usekino.dev');
    expect(borrar).toBeDisabled();
    await userEvent.click(borrar);
    expect(convex.calls).toEqual([]);

    await userEvent.clear(campo);
    await userEvent.type(campo, 'Prueba@UseKino.dev');
    expect(borrar).toBeEnabled();
    await userEvent.click(borrar);

    expect(convex.calls).toContainEqual({ kind: 'action', name: 'account:remove', args: { email: 'Prueba@UseKino.dev' } });
  });

  it('un comienzo del correo no basta: sigue apagado hasta escribirlo entero', async () => {
    renderWithProviders(<Cuerpo />, { convex: makeTestConvexClient() });

    const borrar = screen.getByRole('button', { name: 'Borrar mi cuenta' });
    await userEvent.type(screen.getByLabelText(/para confirmar/), 'prueba@usekino');
    expect(borrar).toBeDisabled();
  });

  it('el mismo correo con otras mayúsculas y espacios alrededor sí lo habilita', async () => {
    renderWithProviders(<Cuerpo />, { convex: makeTestConvexClient() });

    await userEvent.type(screen.getByLabelText(/para confirmar/), '  PRUEBA@usekino.DEV ');
    expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeEnabled();
  });
});

describe('DangerZoneSection', () => {
  it('la confirmación pide el correo de la cuenta con la sesión abierta', async () => {
    const convex = makeTestConvexClient([stubQuery(api.users.current, { ...CUENTA_DE_PRUEBA, email: 'otra.cuenta@usekino.dev' })]);
    renderWithProviders(<DangerZoneSection />, { convex });

    await userEvent.click(await screen.findByRole('button', { name: /Borrar la cuenta/ }));

    const dialogo = await screen.findByRole('dialog', { name: 'Borrar tu cuenta' });
    expect(within(dialogo).getByText('otra.cuenta@usekino.dev')).toBeVisible();
  });
});
