/**
 * Criterio: Ajustes es un índice en tres grupos por frecuencia (Cada día,
 * Cuenta, Una vez) con el borrado de la cuenta al final; cada fila dice su
 * valor; tocar una fila abre su hoja; el regreso del OAuth de GitHub abre
 * Conexiones y al cerrarla la URL deja de decirlo; y con los avisos
 * bloqueados la fila explica cómo desbloquearlos.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('@/shared/testing/navigation')).navigationMock());

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { setNavigation, testRouter } from '@/shared/testing/navigation';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { SettingsIndex, SettingsIndexSkeleton } from './SettingsIndex';
import { AJUSTES_DE_PRUEBA, CUENTA_DE_PRUEBA } from './settings-fixtures';

function cliente() {
  return makeTestConvexClient([
    stubQuery(api.settings.get, AJUSTES_DE_PRUEBA),
    stubQuery(api.energy.profile, {
      chronotype: 'morning',
      sleepTypicalHours: 7,
      availableHoursPerDay: 6,
      rechargePresets: [],
      hasLearnedCurve: false,
    }),
    stubQuery(api.notifications.estado, { dispositivos: 2, pushConfigurado: true, correoConfigurado: true, email: 'ana@usekino.dev' }),
    stubQuery(api.users.current, CUENTA_DE_PRUEBA),
    stubQuery(api.connections.list, [{ provider: 'github', connected: true, lastSyncedAt: null, linkedSystems: 1 }]),
  ]);
}

afterEach(() => vi.unstubAllGlobals());

describe('SettingsIndex', () => {
  it('tres grupos por frecuencia, y borrar la cuenta es la última fila', () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    const grupos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(grupos).toEqual(['Cada día', 'Cuenta', 'Una vez']);

    const unaVez = screen.getByRole('region', { name: 'Una vez' });
    const filas = within(unaVez).getAllByRole('button');
    expect(filas.at(-1)).toHaveTextContent('Borrar la cuenta');
  });

  it('cada fila dice su valor sin abrir nada, y el límite dice qué es un punto', () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    expect(screen.getByRole('button', { name: /Recordatorios/ })).toHaveTextContent('Resumen a las 8:00');
    expect(screen.getByRole('button', { name: /Recordatorios/ })).toHaveTextContent('Agresivos');
    expect(screen.getByRole('button', { name: /Perfil de energía/ })).toHaveTextContent('Mañana, 6 h para tareas');
    expect(screen.getByRole('button', { name: /Revisión semanal/ })).toHaveTextContent('Dom');
    expect(screen.getByRole('button', { name: /Ana Prueba/ })).toHaveTextContent('ana@usekino.dev');
    expect(screen.getByRole('button', { name: /Conexiones/ })).toHaveTextContent('GitHub, conectada');
    // El texto normalizado: los espacios duros que unen cada peso a su cifra cuentan como espacios.
    expect(screen.getByText('Puntos: alta 5, media 3, baja 1')).toBeVisible();
  });

  it('tocar una fila abre su hoja con el título de la sección', async () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    await userEvent.click(screen.getByRole('button', { name: /Revisión semanal/ }));

    const hoja = await screen.findByRole('dialog', { name: 'Revisión semanal' });
    expect(await within(hoja).findByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Agentes abre su hoja con una pestaña por cliente', async () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    await userEvent.click(screen.getByRole('button', { name: /Agentes/ }));

    const hoja = await screen.findByRole('dialog', { name: 'Agentes' });
    const pestanas = await within(hoja).findAllByRole('tab');
    expect(pestanas.map((p) => p.textContent)).toEqual(['Claude', 'Claude Code', 'ChatGPT', 'Codex de OpenAI']);
  });

  it('el regreso del OAuth de GitHub abre Conexiones, y al cerrarla la URL lo olvida', async () => {
    setNavigation({ pathname: '/settings', search: '?github=connected' });
    renderMobile(<SettingsIndex />, { convex: cliente() });

    const hoja = await screen.findByRole('dialog', { name: 'Conexiones' });
    expect(hoja).toBeVisible();
    expect(testRouter.replace).not.toHaveBeenCalled();

    await userEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }));
    expect(testRouter.replace).toHaveBeenCalledWith('/settings', { scroll: false });
  });

  it('con los avisos bloqueados, la fila abre cómo desbloquearlos', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: {} });
    renderMobile(<SettingsIndex />, { convex: cliente() });

    const fila = await screen.findByRole('button', { name: /Bloqueados en este navegador/ });
    await userEvent.click(fila);

    const hoja = await screen.findByRole('dialog', { name: 'Avisos bloqueados' });
    expect(within(hoja).getByText(/En Notificaciones, elige Permitir/)).toBeVisible();
  });

  it('Agentes vive en Cuenta, y cada fila del índice lleva su glifo en el margen', () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    expect(within(screen.getByRole('region', { name: 'Cuenta' })).getByRole('button', { name: /Agentes/ })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Una vez' })).queryByRole('button', { name: /Agentes/ })).toBeNull();

    const margenes = [...document.querySelectorAll('[data-slot="settings-index"] [data-slot="margin-row-margin"]')];
    expect(margenes.length).toBeGreaterThan(0);
    for (const margen of margenes) expect(margen.querySelector('svg')).not.toBeNull();
  });

  it('el esqueleto tiene los mismos grupos y las mismas filas que el índice', () => {
    const real = renderMobile(<SettingsIndex />, { convex: cliente() });
    const delIndice = [...real.container.querySelectorAll('[data-slot="settings-group"]')].map((g) => ({
      titulo: g.querySelector('h2')?.textContent,
      filas: g.querySelectorAll(':scope > div > *').length,
    }));
    real.unmount();

    const esqueleto = renderMobile(<SettingsIndexSkeleton />).container;
    const delEsqueleto = [...esqueleto.querySelectorAll('[data-slot="settings-index-skeleton"] section')].map((g) => ({
      titulo: g.querySelector('h2')?.textContent,
      filas: g.querySelectorAll(':scope > div > *').length,
    }));
    expect(delEsqueleto).toEqual(delIndice);
    expect(delIndice.map((g) => g.titulo)).toEqual(['Cada día', 'Cuenta', 'Una vez']);
  });
});
