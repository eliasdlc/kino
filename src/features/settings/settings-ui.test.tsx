/**
 * Criterio: las filas de Ajustes miden lo mismo con o sin datos (la meta que
 * falta ocupa su renglón), el interruptor se cambia tocando cualquier parte de
 * su fila, y el stepper mueve un paso por toque sin salirse de sus límites y
 * espera desactivado mientras no hay valor.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/shared/testing/render';
import { IndexRow, Stepper, SwitchRow } from './settings-ui';

describe('IndexRow', () => {
  it('sin meta reserva su renglón con la misma altura que con meta', () => {
    const { rerender } = renderWithProviders(<IndexRow icon={null} title="Recordatorios" meta={undefined} onOpen={() => {}} />);
    const vacia = document.querySelector('[data-slot="settings-meta"]')!;
    expect(vacia).toHaveClass('h-5', 'truncate', 'leading-5');
    expect(vacia.querySelector('[data-slot="pendiente"]')).toBeInTheDocument();

    rerender(<IndexRow icon={null} title="Recordatorios" meta="Resumen a las 8:00" onOpen={() => {}} />);
    const llena = document.querySelector('[data-slot="settings-meta"]')!;
    expect(llena).toHaveClass('h-5', 'truncate', 'leading-5');
    expect(llena).toHaveTextContent('Resumen a las 8:00');
  });

  it('con onOpen es un botón que anuncia su hoja', async () => {
    const abrir = vi.fn();
    renderWithProviders(<IndexRow icon={null} title="Papelera" meta="Lo borrado" onOpen={abrir} />);
    const fila = screen.getByRole('button', { name: /Papelera/ });
    expect(fila).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(fila);
    expect(abrir).toHaveBeenCalledOnce();
  });
});

describe('SwitchRow', () => {
  it('tocar el título de la fila cambia el interruptor', async () => {
    const cambiar = vi.fn();
    renderWithProviders(
      <SwitchRow icon={null} title="Avisos en este dispositivo" meta="Apagados aquí" checked={false} onCheckedChange={cambiar} />,
    );
    const interruptor = screen.getByRole('switch', { name: 'Avisos en este dispositivo' });
    expect(interruptor).toHaveAccessibleDescription('Apagados aquí');

    await userEvent.click(screen.getByText('Apagados aquí'));
    expect(cambiar).toHaveBeenCalledWith(true);
    expect(interruptor.closest('label')).toHaveClass('min-h-[3.4rem]');
  });

  it('desactivado no cambia aunque se toque la fila', async () => {
    const cambiar = vi.fn();
    renderWithProviders(<SwitchRow icon={null} title="Por correo" meta="Sin correo" checked={false} disabled onCheckedChange={cambiar} />);
    await userEvent.click(screen.getByText('Por correo'));
    expect(cambiar).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Por correo' })).toBeDisabled();
  });
});

describe('Stepper', () => {
  it('un toque es un paso, y en el tope el botón se desactiva', async () => {
    const cambiar = vi.fn();
    const { rerender } = renderWithProviders(<Stepper value={50} min={1} max={55} step={5} onChange={cambiar} stepLabel="5 puntos" />);

    await userEvent.click(screen.getByRole('button', { name: 'Sumar 5 puntos' }));
    expect(cambiar).toHaveBeenLastCalledWith(55);
    await userEvent.click(screen.getByRole('button', { name: 'Restar 5 puntos' }));
    expect(cambiar).toHaveBeenLastCalledWith(45);

    rerender(<Stepper value={55} min={1} max={55} step={5} onChange={cambiar} stepLabel="5 puntos" />);
    expect(screen.getByRole('button', { name: 'Sumar 5 puntos' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('55');
  });

  it('el paso que se pasaría del mínimo se queda en el mínimo', async () => {
    const cambiar = vi.fn();
    renderWithProviders(<Stepper value={3} min={1} max={500} step={5} onChange={cambiar} stepLabel="5 puntos" />);
    await userEvent.click(screen.getByRole('button', { name: 'Restar 5 puntos' }));
    expect(cambiar).toHaveBeenCalledWith(1);
  });

  it('sin valor espera con los dos botones desactivados', () => {
    renderWithProviders(<Stepper value={undefined} min={1} max={500} step={5} onChange={() => {}} stepLabel="5 puntos" />);
    expect(screen.getByRole('button', { name: 'Sumar 5 puntos' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restar 5 puntos' })).toBeDisabled();
  });
});
