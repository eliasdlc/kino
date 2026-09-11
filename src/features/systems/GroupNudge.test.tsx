import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderMobile } from '@/shared/testing/render';
import { GroupNudge, ITEMS_PARA_EMPUJAR } from './GroupNudge';

/**
 * El empuje de Bandeja es el primero de los dos del principio 7 y el único que
 * no pasa por la cola. Lo que se prueba es justo eso: que no pide una decisión,
 * porque el día que la pida se come la única apertura del día.
 */

describe('GroupNudge', () => {
  it('no aparece por debajo del umbral', () => {
    renderMobile(<GroupNudge count={ITEMS_PARA_EMPUJAR - 1} onTriage={() => {}} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('aparece en el umbral y dice la cifra delante', () => {
    renderMobile(<GroupNudge count={ITEMS_PARA_EMPUJAR} onTriage={() => {}} />);

    expect(screen.getByText(String(ITEMS_PARA_EMPUJAR))).toBeInTheDocument();
  });

  it('no pide una decisión: un solo control y ninguno de descartar', () => {
    renderMobile(<GroupNudge count={12} onTriage={() => {}} />);

    // Sin acuse que persistir, tampoco hay botón que lo finja: la fila se va
    // cuando la Bandeja baja de ocho, no cuando alguien la silencia.
    const controles = screen.getAllByRole('button');
    expect(controles).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /descartar|dejarlo|ocultar|luego/i })).not.toBeInTheDocument();
  });

  it('su único control lleva a repartirlas de verdad', async () => {
    const user = userEvent.setup();
    const onTriage = vi.fn();
    renderMobile(<GroupNudge count={9} onTriage={onTriage} />);

    await user.click(screen.getByRole('button', { name: 'Repartirlas' }));

    expect(onTriage).toHaveBeenCalledOnce();
  });
});
