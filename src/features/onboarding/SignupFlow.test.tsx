import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderMobile, stubMutation } from '@/shared/testing/render';
import { testRouter } from '@/shared/testing/navigation';
import { SignupFlow } from './SignupFlow';

vi.mock('next/navigation', async () => (await import('@/shared/testing/navigation')).navigationMock());

const track = vi.hoisted(() => vi.fn());
vi.mock('@/shared/observability/analytics.client', () => ({ track }));

/**
 * El alta entera: una pantalla, una pregunta y un botón que ya funciona. La
 * segunda pantalla es Hoy, así que lo que se prueba de ella es que el flujo
 * empuja allí después de escribir.
 */

function cliente() {
  return makeTestConvexClient([], [stubMutation(api.onboarding.complete, { ok: true })]);
}

describe('SignupFlow', () => {
  it('es una pantalla con una sola pregunta', () => {
    renderMobile(<SignupFlow />, { convex: cliente() });

    expect(screen.getByRole('heading', { name: '¿En qué trabajas?' })).toBeInTheDocument();
    // Una: la del arquetipo. Ni cronotipo, ni sueño, ni horas, ni recarga.
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('el botón de entrar está activo desde el primer momento', () => {
    renderMobile(<SignupFlow />, { convex: cliente() });

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('entrar escribe el alta de golpe y aterriza en Hoy', async () => {
    const user = userEvent.setup();
    const convex = cliente();
    renderMobile(<SignupFlow />, { convex });

    await user.click(screen.getByRole('radio', { name: /Escritura/ }));
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(testRouter.push).toHaveBeenCalledWith('/dashboard'));
    expect(convex.calls).toHaveLength(1);
    expect(convex.calls[0]!.args).toMatchObject({ identity: 'escritor' });
    // La zona horaria viaja sola: es lo que ancla "hoy" en el plan sembrado.
    expect(convex.calls[0]!.args.timezone).toBeTypeOf('string');
  });

  it('sin tocar nada entra con el arquetipo neutro, no con el primero de la lista', async () => {
    const user = userEvent.setup();
    const convex = cliente();
    renderMobile(<SignupFlow />, { convex });

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(convex.calls).toHaveLength(1));
    expect(convex.calls[0]!.args).toMatchObject({ identity: 'propio' });
  });

  it('mide la elección una sola vez por arquetipo distinto', async () => {
    const user = userEvent.setup();
    track.mockClear();
    renderMobile(<SignupFlow />, { convex: cliente() });

    const escritura = screen.getByRole('radio', { name: /Escritura/ });
    await user.click(escritura);
    await user.click(escritura);
    await user.click(screen.getByRole('radio', { name: /Académico/ }));

    const elecciones = track.mock.calls.filter(([event]) => event === 'archetype_chosen');
    expect(elecciones).toEqual([
      ['archetype_chosen', { segment: null, identity: 'escritor' }],
      ['archetype_chosen', { segment: null, identity: 'estudiante' }],
    ]);
  });

  it('el arquetipo que trae la landing no cuenta como una elección', async () => {
    const user = userEvent.setup();
    track.mockClear();
    renderMobile(<SignupFlow initialIdentity="escritor" segment="escritores" />, { convex: cliente() });

    await user.click(screen.getByRole('radio', { name: /Escritura/ }));

    expect(track.mock.calls.filter(([event]) => event === 'archetype_chosen')).toEqual([]);
  });

  it('si la escritura falla, lo dice y deja volver a intentarlo', async () => {
    const user = userEvent.setup();
    const convex = makeTestConvexClient();
    convex.mutation = () => Promise.reject(new Error('sin red'));
    renderMobile(<SignupFlow />, { convex });

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal, intenta de nuevo.');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(testRouter.push).not.toHaveBeenCalled();
  });
});
