import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api } from '@convex/_generated/api';
import { makeFolder, makeSystem, makeTask, mid } from '@/app/system-design/mock-data';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import { SYSTEM_TYPE_CONFIG } from '@/shared/lib/system-types';
import { PersonalView } from './PersonalView';

/**
 * La vista de un sistema cuyo contenedor es un área. Lo que se prueba es que ni
 * una palabra de la pantalla se escribió en el componente: el plural del
 * contenedor y el nombre de cada tipo de tarea salen del manifiesto.
 */

const CASA = makeSystem({
  id: mid('sys-p'),
  name: 'Casa y salud',
  templateType: 'personal',
  icon: 'star',
});

const MANIFIESTO = SYSTEM_TYPE_CONFIG.personal;
const AREAS = MANIFIESTO.folderRole!.nounPlural;
const HABITO = MANIFIESTO.taskKinds.find((kind) => kind.id === 'habit')!.label;

const SALUD = makeFolder({ id: mid('fold-1'), name: 'Salud', systemId: CASA.id });

function conCarpetas(folders: ReturnType<typeof makeFolder>[]) {
  return makeTestConvexClient([stubQuery(api.folders.bySystem, folders)]);
}

describe('PersonalView', () => {
  it('nombra el contenedor con el plural del manifiesto', () => {
    renderMobile(<PersonalView system={CASA} initialTasks={[]} />, { convex: conCarpetas([SALUD]) });

    expect(screen.getByRole('heading', { name: AREAS })).toBeInTheDocument();
    expect(screen.getByText('Salud')).toBeInTheDocument();
  });

  it('pone Hoy delante de las áreas, que es lo único con hora de caducidad', () => {
    const habito = makeTask({
      id: mid('task-h'),
      systemId: CASA.id,
      title: 'Caminar 30 minutos',
      status: 'today',
      metadata: { kind: 'habit' },
    });
    renderMobile(<PersonalView system={CASA} initialTasks={[habito]} />, {
      convex: conCarpetas([SALUD]),
    });

    const secciones = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(secciones).toEqual(['Hoy', AREAS]);
    expect(screen.getByText('Caminar 30 minutos')).toBeInTheDocument();
    // El tipo de tarea también sale del manifiesto: "Hábito", no "habit".
    expect(screen.getByText(HABITO)).toBeInTheDocument();
  });

  it('sin nada en el plan lo dice, en vez de dejar la sección en blanco', () => {
    renderMobile(<PersonalView system={CASA} initialTasks={[]} />, { convex: conCarpetas([SALUD]) });

    expect(screen.getByText(/Hoy no hay nada de este sistema en el plan/)).toBeInTheDocument();
  });

  it('sin áreas lo dice con el sustantivo del manifiesto', () => {
    renderMobile(<PersonalView system={CASA} initialTasks={[]} />, { convex: conCarpetas([]) });

    expect(screen.getByText(new RegExp(`Todavía no hay ${AREAS}`))).toBeInTheDocument();
  });

  it('cada área cuenta sus pendientes, no sus subcarpetas', () => {
    const dentro = [1, 2].map((i) =>
      makeTask({ id: mid(`task-a${i}`), systemId: CASA.id, folderId: SALUD.id, status: 'backlog' }),
    );
    const cerrada = makeTask({
      id: mid('task-a3'),
      systemId: CASA.id,
      folderId: SALUD.id,
      status: 'done',
    });
    renderMobile(<PersonalView system={CASA} initialTasks={[...dentro, cerrada]} />, {
      convex: conCarpetas([SALUD]),
    });

    expect(screen.getByRole('link', { name: /Salud/ })).toHaveTextContent('2');
  });
});
