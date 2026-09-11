import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import type { VocabularyWord } from '@convex/schema';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { almohadillaEn, TagAffordance } from './TagAffordance';

/**
 * La puerta de la etiqueta. Las etiquetas existían en un selector con su nombre
 * puesto, que es explicar el vocabulario; aquí la palabra aparece cuando
 * escribes una almohadilla, y sólo la primera vez.
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

describe('almohadillaEn', () => {
  it('reconoce la primera y le quita el signo', () => {
    expect(almohadillaEn('Revisar #beca antes del viernes')).toBe('beca');
    expect(almohadillaEn('#uno y #dos')).toBe('uno');
    expect(almohadillaEn('acentos y ñ: #diseño')).toBe('diseño');
  });

  it('una almohadilla suelta no es una etiqueta', () => {
    expect(almohadillaEn('el # de la puerta')).toBeNull();
    expect(almohadillaEn('sin nada')).toBeNull();
  });
});

describe('TagAffordance', () => {
  it('no aparece sin almohadilla', () => {
    renderMobile(<TagAffordance text="Llamar al banco" onCreate={() => {}} />, { convex: cliente() });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aparece con la almohadilla y enseña el nombre que va a crear', () => {
    renderMobile(<TagAffordance text="Revisar #beca" onCreate={() => {}} />, { convex: cliente() });

    expect(screen.getByText('#beca')).toBeInTheDocument();
  });

  it('no vuelve si ya apareció una vez', () => {
    renderMobile(<TagAffordance text="Revisar #beca" onCreate={() => {}} />, {
      convex: cliente(['etiqueta']),
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('crea la etiqueta con el nombre escrito, sin el signo', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    renderMobile(<TagAffordance text="Revisar #beca antes" onCreate={onCreate} />, { convex: cliente() });

    await user.click(screen.getByRole('button', { name: 'Crearla' }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith('beca');
  });
});
