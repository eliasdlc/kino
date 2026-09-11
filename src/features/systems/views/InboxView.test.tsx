import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeSystem, makeTask, mid } from '@/app/system-design/mock-data';
import { renderMobile } from '@/shared/testing/render';
import { ITEMS_PARA_EMPUJAR } from '@/features/systems/GroupNudge';
import { InboxView, ITEMS_VISIBLES } from './InboxView';

/**
 * Bandeja en sus cuatro estados. El que más importa es el de un item: una lista
 * vacía con una cosa flotando es el estado que nadie diseña y el que casi todo
 * el mundo ve el primer día.
 */

const BANDEJA = makeSystem({ id: mid('sys-0'), name: 'Bandeja', templateType: 'inbox', isInbox: true });

function items(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeTask({ id: mid(`task-${i}`), systemId: BANDEJA.id, title: `Cosa ${i + 1}`, status: 'backlog' }),
  );
}

describe('InboxView', () => {
  it('vacía dice para qué sirve el sitio, no un hueco', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} />);

    expect(screen.getByRole('heading', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByText(/Bandeja está vacía/)).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('con un solo item no pinta una lista con una cosa flotando', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(1)} />);

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByText(/Una cosa esperando/)).toBeInTheDocument();
  });

  it('por debajo del umbral no hay empuje', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(ITEMS_PARA_EMPUJAR - 1)} />);

    expect(screen.queryByRole('button', { name: 'Repartirlas' })).not.toBeInTheDocument();
  });

  it('en el umbral aparece el empuje, y sigue siendo una fila sin pregunta', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(ITEMS_PARA_EMPUJAR)} />);

    expect(screen.getByRole('button', { name: 'Repartirlas' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(ITEMS_PARA_EMPUJAR);
  });

  it('con quinientos pinta el tope y dice cuántos quedan', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(500)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(ITEMS_VISIBLES);
    expect(screen.getByText(`Quedan ${500 - ITEMS_VISIBLES} más sin pintar. Repártelas y la lista baja.`)).toBeInTheDocument();
  });

  it('reserva el hueco de la fuente y lo llena cuando la hay', () => {
    const desdeFuera = makeTask({
      id: mid('task-x'),
      systemId: BANDEJA.id,
      title: 'Arreglar el bug del calendario',
      status: 'backlog',
      externalSource: 'github',
    });
    renderMobile(<InboxView system={BANDEJA} initialTasks={[desdeFuera, ...items(2)]} />);

    // El glifo existe para lo que ya tiene fuente; las capturas y las fuentes
    // conectadas llegan después y encuentran el sitio hecho.
    expect(screen.getByLabelText('github')).toBeInTheDocument();
  });

  it('lo cerrado no cuenta para el montón', () => {
    const cerradas = items(3).map((task) => ({ ...task, status: 'done' as const }));
    renderMobile(<InboxView system={BANDEJA} initialTasks={[...items(2), ...cerradas]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
