import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import type { VocabularyWord } from '@convex/schema';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { SelectionToolbar } from './SelectionToolbar';

/**
 * La tercera puerta y la más fina: seleccionar texto. Es la única de las tres
 * que hasta ahora no tenía ni gesto ni test, y las notas sólo nacían con un
 * click derecho sobre un hueco vacío.
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

const MARCADO = 'la casa estaba vacía desde marzo';

describe('SelectionToolbar', () => {
  it('sin selección no hay puerta', () => {
    renderMobile(<SelectionToolbar selection="" onAnnotate={() => {}} />, { convex: cliente() });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('una selección de sólo espacios tampoco es un gesto', () => {
    renderMobile(<SelectionToolbar selection="   " onAnnotate={() => {}} />, { convex: cliente() });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aparece al marcar texto y dice la palabra', () => {
    renderMobile(<SelectionToolbar selection={MARCADO} onAnnotate={() => {}} />, { convex: cliente() });

    expect(screen.getByText(/nota adhesiva/)).toBeInTheDocument();
  });

  it('no vuelve si ya apareció una vez', () => {
    renderMobile(<SelectionToolbar selection={MARCADO} onAnnotate={() => {}} />, {
      convex: cliente(['notaAdhesiva']),
    });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('la nota nace pegada a lo que estabas leyendo', async () => {
    const user = userEvent.setup();
    const onAnnotate = vi.fn();
    renderMobile(<SelectionToolbar selection={MARCADO} onAnnotate={onAnnotate} />, { convex: cliente() });

    await user.click(screen.getByRole('button', { name: 'Anotarlo' }));

    expect(onAnnotate).toHaveBeenCalledExactlyOnceWith(MARCADO);
  });
});
