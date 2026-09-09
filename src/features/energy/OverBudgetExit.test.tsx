import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { api } from '@convex/_generated/api';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { mid } from '@/app/system-design/mock-data';
import { OverBudgetExit } from './OverBudgetExit';

/**
 * El día que no cabe. Lo que se prueba es lo que el bloque **no** hace: no
 * afirma que acabas de pasarte, no ofrece silenciarlo y no usa rojo.
 */

const SOBREGIRO = {
  committed: 62,
  limit: 50,
  overBy: 12,
  mover: [
    { id: mid('t-1'), title: 'Leer el syllabus de Bases de Datos', points: 3 },
    { id: mid('t-2'), title: 'Outline: en qué termina la historia', points: 3 },
    { id: mid('t-3'), title: 'Cambiar el filtro del agua', points: 1 },
  ],
};

function cliente(value: typeof SOBREGIRO | null) {
  return makeTestConvexClient([stubQuery(api.energy.overBudgetExit, value)]);
}

describe('OverBudgetExit', () => {
  it('no se pinta cuando el día cabe', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(null) });

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('empieza por la cifra, y el sujeto de la frase es el día', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    expect(screen.getByText('El día queda en 62 de 50 puntos.')).toBeInTheDocument();
  });

  it('no afirma que el sobregiro venga de un gesto reciente', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    // El plan se repuebla al leerlo y el ritual reparte a medianoche: un
    // sobregiro del martes puede no venir de ningún gesto del martes.
    const bloque = screen.getByRole('region');
    expect(bloque.textContent).not.toMatch(/acabas de|te pasaste|agregaste/i);
  });

  it('enseña las tres que ofrece mover, con sus puntos', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    const filas = screen.getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas.map((fila) => fila.textContent)).toEqual([
      'Leer el syllabus de Bases de Datos3 pt',
      'Outline: en qué termina la historia3 pt',
      'Cambiar el filtro del agua1 pt',
    ]);
  });

  it('un solo control, y ninguno de dejarlo así', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    const controles = screen.getAllByRole('button');
    expect(controles).toHaveLength(1);
    expect(controles[0]).toHaveAccessibleName('Mover las 3 a mañana');
  });

  it('el control mide al menos 48 px de alto', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    // La gramática pide 48 mínimo, y la única interrupción diaria los medía.
    expect(screen.getByRole('button').className).toContain('h-12');
  });

  it('ningún estado usa rojo: el sobregiro es el acento', () => {
    renderMobile(<OverBudgetExit />, { convex: cliente(SOBREGIRO) });

    const bloque = screen.getByRole('region');
    expect(bloque.className).toContain('border-primary');
    expect(bloque.outerHTML).not.toMatch(/destructive|task-overdue|text-red|bg-red/);
  });

  it('mover las tres las manda a mañana, y las tres', async () => {
    const user = userEvent.setup();
    const convex = cliente(SOBREGIRO);
    renderMobile(<OverBudgetExit />, { convex });

    await user.click(screen.getByRole('button'));

    expect(convex.calls).toHaveLength(3);
    expect(convex.calls.map((call) => call.args.id)).toEqual(SOBREGIRO.mover.map((t) => t.id));
    expect(convex.calls[0]!.args.inTodayPlan).toBe(false);
  });
});
