/**
 * Criterio: la hoja de Perfil de energía guarda cada control al tocarlo, sin
 * botón Guardar: el cronotipo en el toque, las pastillas en el toque y con un
 * tope de ocho (las que faltan se apagan, las elegidas se pueden quitar). Sin
 * perfil declarado enseña el estado vacío y no controles muertos.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderWithProviders, stubMutation, stubQuery } from '@/shared/testing/render';
import { EnergyProfileSection, MAX_PRESETS } from './EnergyProfileSection';

type Perfil = NonNullable<Parameters<typeof stubQuery<typeof api.energy.profile>>[1]>;

const PERFIL: Perfil = {
  chronotype: 'intermediate',
  sleepTypicalHours: 7,
  availableHoursPerDay: 6,
  rechargePresets: [{ label: 'Salir a caminar', delta: 15 }],
  hasLearnedCurve: false,
};

const OCHO = [
  { label: 'Dormir una siesta', delta: 20 },
  { label: 'Salir a caminar', delta: 15 },
  { label: 'Escuchar música', delta: 10 },
  { label: 'Meditar', delta: 15 },
  { label: 'Comer bien', delta: 10 },
  { label: 'Hablar con alguien', delta: 10 },
  { label: 'Videojuegos', delta: 5 },
  { label: 'Comer te cansa', delta: -10 },
];

function cliente(perfil: Perfil | null) {
  return makeTestConvexClient([stubQuery(api.energy.profile, perfil)], [stubMutation(api.energy.updateProfile, { ok: true })]);
}

describe('EnergyProfileSection', () => {
  it('elegir otro cronotipo lo guarda al tocarlo, sin botón Guardar', async () => {
    const convex = cliente(PERFIL);
    renderWithProviders(<EnergyProfileSection />, { convex });

    await userEvent.click(screen.getByRole('radio', { name: 'Noche' }));

    await waitFor(() =>
      expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'energy:updateProfile', args: { chronotype: 'evening' } }),
    );
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
  });

  it('con ocho pastillas las que faltan se apagan y una elegida se puede quitar', async () => {
    expect(MAX_PRESETS).toBe(8);
    const convex = cliente({ ...PERFIL, rechargePresets: OCHO });
    renderWithProviders(<EnergyProfileSection />, { convex });

    expect(screen.getByRole('button', { name: /Redes sociales/ })).toBeDisabled();
    const meditar = screen.getByRole('button', { name: /Meditar/ });
    expect(meditar).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(meditar);

    await waitFor(() => {
      const escritura = convex.calls.find((c) => c.name === 'energy:updateProfile');
      expect(escritura?.args.rechargePresets).toHaveLength(7);
    });
  });

  it('sin perfil declarado enseña el estado vacío', () => {
    renderWithProviders(<EnergyProfileSection />, { convex: cliente(null) });

    expect(screen.getByText('Todavía no hay perfil de energía.')).toBeVisible();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('la frase de arriba habla de punto de partida, sin jerga', () => {
    renderWithProviders(<EnergyProfileSection />, { convex: cliente(PERFIL) });

    expect(screen.getByText(/es el punto de partida; con el tiempo, lo medido pesa más/)).toBeVisible();
    expect(screen.queryByText(/hipótesis/)).not.toBeInTheDocument();
  });
});
