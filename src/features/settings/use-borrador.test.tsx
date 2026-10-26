/**
 * Criterio: el borrador de un control que guarda al tocar cumple sus dos
 * promesas fuera del camino feliz. Si el control se desmonta con un toque
 * pendiente (se cierra la hoja), ese toque se escribe en ese momento; y si
 * la escritura falla, el control vuelve al valor de la cuenta.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/shared/testing/render';
import { ESPERA_GUARDADO_MS, useBorrador } from './use-borrador';

/** Un control mínimo: enseña el valor y un botón que le suma uno. */
function Contador({ servidor, guardar }: { servidor: number; guardar: (valor: number, terminado: () => void) => void }) {
  const [valor, cambiar] = useBorrador(servidor, guardar);
  return (
    <button type="button" onClick={() => cambiar((valor ?? 0) + 1)}>
      {valor}
    </button>
  );
}

describe('useBorrador', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('un toque pendiente se escribe al desmontar, sin esperar', () => {
    const guardar = vi.fn();
    const { unmount } = renderWithProviders(<Contador servidor={10} guardar={guardar} />);

    fireEvent.click(screen.getByRole('button'));
    expect(guardar).not.toHaveBeenCalled();
    unmount();

    expect(guardar).toHaveBeenCalledTimes(1);
    expect(guardar.mock.calls[0]?.[0]).toBe(11);
  });

  it('si la escritura falla, el control vuelve al valor de la cuenta', async () => {
    // La escritura termina sin que la cuenta cambie: es lo que deja un fallo.
    const guardar = vi.fn((_valor: number, terminado: () => void) => terminado());
    renderWithProviders(<Contador servidor={10} guardar={guardar} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('11');

    await act(async () => {
      vi.advanceTimersByTime(ESPERA_GUARDADO_MS);
    });
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveTextContent('10');
  });
});
