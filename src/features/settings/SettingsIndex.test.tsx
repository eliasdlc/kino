/**
 * Criterio: Ajustes es un índice en tres grupos por frecuencia (Cada día,
 * Cuenta, Una vez) con el borrado de la cuenta al final; cada fila dice su
 * valor; tocar una fila abre su hoja con el título de la sección; y el
 * regreso del OAuth de GitHub (?github=…) abre Conexiones solo.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => (await import('@/shared/testing/navigation')).navigationMock());

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { setNavigation } from '@/shared/testing/navigation';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { SettingsIndex, SettingsIndexSkeleton } from './SettingsIndex';
import { AJUSTES_DE_PRUEBA } from './settings-fixtures';

const CUENTA = {
  _id: 'u1' as Id<'users'>,
  _creationTime: 0,
  email: 'ana@usekino.dev',
  name: 'Ana Prueba',
  onboardingCompleted: true,
  status: 'active' as const,
  timezone: 'America/Santo_Domingo',
} as unknown as NonNullable<Parameters<typeof stubQuery<typeof api.users.current>>[1]>;

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
    stubQuery(api.users.current, CUENTA),
    stubQuery(api.connections.list, [{ provider: 'github', connected: true, lastSyncedAt: null, linkedSystems: 1 }]),
  ]);
}

describe('SettingsIndex', () => {
  it('tres grupos por frecuencia, y borrar la cuenta es la última fila', () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    const grupos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(grupos).toEqual(['Cada día', 'Cuenta', 'Una vez']);

    const unaVez = screen.getByRole('region', { name: 'Una vez' });
    const filas = within(unaVez).getAllByRole('button');
    expect(filas.at(-1)).toHaveTextContent('Borrar la cuenta');
  });

  it('cada fila dice su valor sin abrir nada', () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    expect(screen.getByRole('button', { name: /Recordatorios/ })).toHaveTextContent('Resumen a las 8:00');
    expect(screen.getByRole('button', { name: /Recordatorios/ })).toHaveTextContent('Agresivos');
    expect(screen.getByRole('button', { name: /Perfil de energía/ })).toHaveTextContent('Mañana, duermes 7 h');
    expect(screen.getByRole('button', { name: /Revisión semanal/ })).toHaveTextContent('Dom');
    expect(screen.getByRole('button', { name: /Ana Prueba/ })).toHaveTextContent('ana@usekino.dev');
    expect(screen.getByRole('button', { name: /Conexiones/ })).toHaveTextContent('GitHub, conectada');
  });

  it('tocar una fila abre su hoja con el título de la sección', async () => {
    renderMobile(<SettingsIndex />, { convex: cliente() });

    await userEvent.click(screen.getByRole('button', { name: /Revisión semanal/ }));

    const hoja = await screen.findByRole('dialog', { name: 'Revisión semanal' });
    expect(await within(hoja).findByRole('radio', { name: 'Domingo' })).toHaveAttribute('aria-checked', 'true');
  });

  it('el regreso del OAuth de GitHub abre Conexiones', async () => {
    setNavigation({ pathname: '/settings', search: '?github=connected' });
    renderMobile(<SettingsIndex />, { convex: cliente() });

    expect(await screen.findByRole('dialog', { name: 'Conexiones' })).toBeVisible();
  });

  it('el esqueleto tiene los mismos grupos y las mismas filas que el índice', () => {
    const { container } = renderMobile(<SettingsIndexSkeleton />);
    const grupos = container.querySelectorAll('section');
    expect([...grupos].map((g) => g.querySelector('h2')?.textContent)).toEqual(['Cada día', 'Cuenta', 'Una vez']);
    // Seis en Cada día, tres en Cuenta, cinco en Una vez (atajos sólo en escritorio).
    expect([...grupos].map((g) => g.querySelectorAll('div > div.grid').length)).toEqual([6, 3, 5]);
  });
});
