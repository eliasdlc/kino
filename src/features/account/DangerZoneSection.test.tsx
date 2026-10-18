/**
 * Criterio: borrar la cuenta sólo se puede después de escribir el correo de la
 * cuenta (sin importar mayúsculas), y lo que se manda es lo escrito. Mientras
 * el correo no coincide, el botón de borrar está apagado y nada sale.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeTestConvexClient, renderWithProviders } from '@/shared/testing/render';
import { useDeleteAccount } from './account.hooks';
import { DeleteAccountBody } from './DangerZoneSection';

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
});
