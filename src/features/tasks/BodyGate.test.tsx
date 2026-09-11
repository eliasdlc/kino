import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import type { VocabularyWord } from '@convex/schema';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { BodyGate, CUERPO_LARGO } from './BodyGate';

/**
 * La puerta del cuaderno. Lo que se prueba no es que aparezca, sino que aparece
 * **una vez**: insistir sería un tercer empuje del sistema y el producto tiene
 * dos.
 */

const AJUSTES = {
  dailyEnergyLimit: 50,
  timezone: 'UTC',
  theme: 'system' as const,
  notificationsEnabled: true,
  weeklyReviewDay: 'sun' as const,
  wordsSeen: [] as VocabularyWord[],
};

function cliente(wordsSeen: VocabularyWord[] = []) {
  return makeTestConvexClient([stubQuery(api.settings.get, { ...AJUSTES, wordsSeen })]);
}

const CORTO = 'Llamar al banco';
const LARGO = 'x'.repeat(CUERPO_LARGO);

describe('BodyGate', () => {
  it('no aparece con un cuerpo corto', () => {
    renderMobile(<BodyGate body={CORTO} onConvert={() => {}} />, { convex: cliente() });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aparece con un cuerpo largo y dice la palabra', () => {
    renderMobile(<BodyGate body={LARGO} onConvert={() => {}} />, { convex: cliente() });

    expect(screen.getByText('Esto ya es una página.')).toBeInTheDocument();
  });

  it('no vuelve si ya apareció una vez', () => {
    renderMobile(<BodyGate body={LARGO} onConvert={() => {}} />, { convex: cliente(['pagina']) });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('se recuerda al enseñarla, no al aceptarla: ignorarla también la gasta', () => {
    const convex = cliente();
    renderMobile(<BodyGate body={LARGO} onConvert={() => {}} />, { convex });

    expect(convex.calls).toEqual([
      { kind: 'mutation', name: 'settings:markWordSeen', args: { word: 'pagina' } },
    ]);
  });

  it('su único control convierte el cuerpo de verdad', async () => {
    const user = userEvent.setup();
    const onConvert = vi.fn();
    renderMobile(<BodyGate body={LARGO} onConvert={onConvert} />, { convex: cliente() });

    await user.click(screen.getByRole('button', { name: 'Convertirla' }));

    expect(onConvert).toHaveBeenCalledOnce();
  });
});
