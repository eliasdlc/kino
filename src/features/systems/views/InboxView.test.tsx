import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import { makeSystem, makeTask, mid } from '@/app/system-design/mock-data';
import { makeTestConvexClient, renderMobile, stubQuery } from '@/shared/testing/render';
import type { CaptureItem } from '@/features/captures/captures.types';
import { ITEMS_PARA_EMPUJAR } from '@/features/systems/GroupNudge';
import { InboxView, ITEMS_VISIBLES } from './InboxView';

/**
 * Bandeja en sus estados. El que más importa es el de un item: una lista
 * vacía con una cosa flotando es el estado que nadie diseña y el que casi todo
 * el mundo ve el primer día. Y completar tacha en el sitio con Deshacer, sin
 * que la fila se vaya mientras se mira.
 */

const toastSpy = vi.hoisted(() => Object.assign(vi.fn((..._args: unknown[]) => 'aviso'), { dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastSpy }));

function captura(campos: Partial<CaptureItem> = {}): CaptureItem {
  return {
    id: 'cap-1',
    kind: 'link',
    status: 'pending',
    text: null,
    url: 'https://react.dev/learn',
    blobPath: null,
    durationSeconds: null,
    proposedItems: null,
    createdAt: 1_757_800_000_000,
    expiresAt: 1_760_392_000_000,
    diasRestantes: 30,
    avisa: false,
    ...campos,
  } as CaptureItem;
}

const BANDEJA = makeSystem({ id: mid('sys-0'), name: 'Bandeja', templateType: 'inbox', isInbox: true });

function items(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeTask({ id: mid(`task-${i}`), systemId: BANDEJA.id, title: `Cosa ${i + 1}`, status: 'backlog' }),
  );
}

describe('InboxView', () => {
  it('vacía dice para qué sirve el sitio y ofrece capturar', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[]} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.getByText(/Bandeja está vacía/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Capturar algo' })).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('con las capturas del servidor no se pinta vacía mientras llega la suscripción', () => {
    // Sin stub, la suscripción de capturas no contesta: lo que se ve es lo
    // que leyó el servidor.
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura()]} />, {
      convex: makeTestConvexClient([stubQuery(api.tasks.bySystem, [])]),
    });

    expect(screen.queryByText(/Bandeja está vacía/)).not.toBeInTheDocument();
    expect(screen.getByText('https://react.dev/learn')).toBeVisible();
  });

  it('completar tacha en su sitio, ofrece Deshacer 4 s y deshacer la devuelve', async () => {
    const [tarea] = items(1);
    const { convex } = renderMobile(<InboxView system={BANDEJA} initialTasks={[tarea!]} initialCaptures={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Completar Cosa 1' }));

    expect(screen.getByRole('button', { name: 'Completar Cosa 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cosa 1')).toHaveClass('line-through');
    const opciones = toastSpy.mock.calls.at(-1)?.[1] as unknown as { duration: number; action: { label: string; onClick: () => void } };
    expect(opciones.duration).toBe(4000);
    expect(opciones.action.label).toBe('Deshacer');

    opciones.action.onClick();

    expect(convex.calls.filter((c) => c.name === 'tasks:toggle')).toHaveLength(2);
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
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  it('lo cerrado no cuenta para el montón', () => {
    const cerradas = items(3).map((task) => ({ ...task, status: 'done' as const }));
    renderMobile(<InboxView system={BANDEJA} initialTasks={[...items(2), ...cerradas]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
