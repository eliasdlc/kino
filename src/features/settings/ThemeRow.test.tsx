/**
 * Criterio: el tema es un segmento de tres (Claro, Oscuro, Sistema) con la
 * opción elegida en tinta, un toque lo cambia en este dispositivo y lo guarda
 * en la cuenta, y la línea de debajo nunca contradice al segmento: con Oscuro
 * no dice "sigue al dispositivo", y con Sistema dice qué tema pide ahora.
 * Antes de saber qué eligió este dispositivo no marca ninguna opción.
 */
import { describe, expect, it } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation } from '@/shared/testing/render';
import { useThemeStore } from '@/components/ThemeProvider';
import { ThemeRow, textoTema } from './ThemeRow';
import { AJUSTES_DE_PRUEBA } from './settings-fixtures';

describe('ThemeRow', () => {
  it('elegir Oscuro lo marca, lo guarda y la línea lo dice', async () => {
    const convex = makeTestConvexClient([], [stubMutation(api.settings.update, AJUSTES_DE_PRUEBA)]);
    renderWithProviders(<ThemeRow />, { convex, theme: 'system' });

    const grupo = screen.getByRole('radiogroup', { name: 'Tema' });
    expect(grupo).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Sistema' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Sigue al dispositivo: ahora claro')).toBeVisible();

    await userEvent.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Siempre oscuro en este dispositivo')).toBeVisible();
    expect(screen.queryByText(/Sigue al dispositivo/)).not.toBeInTheDocument();
    expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'settings:update', args: { theme: 'dark' } });
  });

  it('sin saber qué eligió este dispositivo no marca Sistema, y al saberlo marca lo elegido', () => {
    renderWithProviders(<ThemeRow />, { convex: makeTestConvexClient() });

    // Lo que hay antes de leer este dispositivo: el valor por defecto del store.
    act(() => useThemeStore.setState({ mode: 'system', hydrated: false }));
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();

    act(() => useThemeStore.setState({ mode: 'dark', hydrated: true }));
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: 'Sistema', checked: true })).not.toBeInTheDocument();
  });

  it('el texto sale del modo elegido, y con Sistema del tema que pide el dispositivo', () => {
    expect(textoTema('light', true)).toBe('Siempre claro en este dispositivo');
    expect(textoTema('dark', false)).toBe('Siempre oscuro en este dispositivo');
    expect(textoTema('system', true)).toBe('Sigue al dispositivo: ahora oscuro');
    expect(textoTema('system', false)).toBe('Sigue al dispositivo: ahora claro');
    // Sin saber qué pide el dispositivo (en el servidor), no se afirma nada.
    expect(textoTema('system', null)).toBeUndefined();
  });
});
