/**
 * Criterio: Bandeja en sus estados. El que más importa es el de un item: una
 * lista vacía con una cosa flotando es el estado que nadie diseña y el que
 * casi todo el mundo ve el primer día. Completar tacha en el sitio con
 * Deshacer, descartar una captura también se deshace, y confirmar dice cuántas
 * tareas creó y dónde, o, si falla, lo dice en la hoja sin cerrarla.
 */
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFunctionName } from 'convex/server';
import { api } from '@convex/_generated/api';
import { makeSystem, makeTask, mid } from '@/app/system-design/mock-data';
import { testRouter } from '@/shared/testing/navigation';
import { makeTestConvexClient, renderMobile, stubMutation, stubMutationError, stubQuery } from '@/shared/testing/render';
import type { CaptureItem } from '@/features/captures/captures.types';
import { ITEMS_PARA_EMPUJAR } from '@/features/systems/GroupNudge';
import { avisoDeConfirmadas, DESHACER_MS, InboxView, ITEMS_VISIBLES } from './InboxView';

vi.mock('next/navigation', async () => (await import('@/shared/testing/navigation')).navigationMock());

const toastSpy = vi.hoisted(() =>
  Object.assign(vi.fn<(...args: unknown[]) => string>(() => 'aviso'), { dismiss: vi.fn(), error: vi.fn<(...args: unknown[]) => string>() }),
);
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

    act(() => opciones.action.onClick());

    expect(convex.calls.filter((c) => c.name === 'tasks:toggle')).toHaveLength(2);
  });

  it('la fila lleva el círculo del margen de Hoy y Tareas, no una casilla cuadrada', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(2)} initialCaptures={[]} />);

    const completar = screen.getByRole('button', { name: 'Completar Cosa 1' });
    const circulo = completar.querySelector('span')!;
    expect(circulo).toHaveClass('size-[1.35rem]', 'rounded-full', 'border-[1.6px]');
    expect(screen.queryByRole('checkbox')).toBeNull();
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

  it('el contador se oye con su palabra, no como un número suelto', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={items(2)} initialCaptures={[]} />);

    expect(screen.getByText('2 por repartir')).toHaveClass('sr-only');
  });

  it('con capturas, la frase dice que tocarla abre lo que propone', () => {
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura()]} />);

    expect(screen.getByText('1 captura por revisar: tócala.')).toBeVisible();
  });
});

describe('InboxView, las capturas', () => {
  afterEach(() => vi.useRealTimers());

  it('descartar se va de la lista, ofrece Deshacer y deshacer la devuelve sin borrar nada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { convex } = renderMobile(
      <InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: null })]} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartarla' }));

    expect(screen.queryByText('https://react.dev/learn', { selector: 'li *' })).not.toBeInTheDocument();
    const opciones = toastSpy.mock.calls.at(-1)?.[1] as unknown as { duration: number; action: { label: string; onClick: () => void } };
    expect(toastSpy.mock.calls.at(-1)?.[0]).toBe('Captura descartada');
    expect(opciones.action.label).toBe('Deshacer');

    act(() => opciones.action.onClick());
    act(() => vi.advanceTimersByTime(DESHACER_MS + 100));

    // La hoja todavía se está cerrando y tapa la lista para el árbol de
    // accesibilidad: la fila se busca por su texto.
    expect(screen.getByText('https://react.dev/learn', { selector: 'li *' })).toBeInTheDocument();
    expect(convex.calls.filter((c) => c.name === 'captures:descartar')).toHaveLength(0);
  });

  it('descartar desde la hoja la cierra', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: null })]} />);
    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    const hoja = await screen.findByRole('dialog');
    expect(hoja).toHaveAttribute('data-state', 'open');

    await userEvent.click(within(hoja).getByRole('button', { name: 'Descartarla' }));

    // Se queda en el árbol mientras se cierra: lo que dice si sigue abierta es su estado.
    expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state') ?? 'closed').toBe('closed');
  });

  it('sin deshacer, la captura se descarta al pasar los 4 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { convex } = renderMobile(
      <InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: null })]} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartarla' }));
    expect(convex.calls.filter((c) => c.name === 'captures:descartar')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(DESHACER_MS + 100));

    expect(convex.calls.filter((c) => c.name === 'captures:descartar')).toEqual([
      { kind: 'mutation', name: 'captures:descartar', args: { id: 'cap-1' } },
    ]);
  });

  it('si el servidor no la descarta, la fila vuelve y un aviso lo dice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    toastSpy.mockClear();
    toastSpy.error.mockClear();
    const convex = makeTestConvexClient([], [stubMutationError(api.captures.descartar, new Error('sin red'))]);
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: null })]} />, { convex });

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartarla' }));
    expect(screen.queryByText('https://react.dev/learn', { selector: 'li *' })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(DESHACER_MS + 100));

    await vi.waitFor(() => expect(screen.getByText('https://react.dev/learn', { selector: 'li *' })).toBeInTheDocument());
    // Un fallo va por `toast.error`, como los demás de la app, no por el aviso neutro.
    expect(toastSpy.error).toHaveBeenCalledWith(expect.stringMatching(/No se pudo descartar/));
    expect(toastSpy).not.toHaveBeenCalledWith(expect.stringMatching(/No se pudo descartar/));
  });

  it('confirmar dice cuántas tareas creó y dónde', async () => {
    const convex = makeTestConvexClient([], [stubMutation(api.captures.confirmar, { creadas: 2 })]);
    renderMobile(
      <InboxView
        system={BANDEJA}
        initialTasks={[]}
        initialCaptures={[captura({ proposedItems: [{ title: 'Repasar el parcial' }, { title: 'Pedir la rúbrica' }] })]}
      />,
      { convex },
    );

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar 2' }));

    expect(convex.calls).toContainEqual({ kind: 'mutation', name: 'captures:confirmar', args: { id: 'cap-1', indices: [0, 1] } });
    await vi.waitFor(() => expect(toastSpy.mock.calls.at(-1)?.[0]).toBe('2 tareas creadas en Bandeja'));
  });

  it('si confirmar falla, la hoja sigue abierta y dice que no se creó nada', async () => {
    toastSpy.mockClear();
    const convex = makeTestConvexClient([], [stubMutationError(api.captures.confirmar, new Error('sin red'))]);
    renderMobile(
      <InboxView
        system={BANDEJA}
        initialTasks={[]}
        initialCaptures={[captura({ proposedItems: [{ title: 'Repasar el parcial' }, { title: 'Pedir la rúbrica' }] })]}
      />,
      { convex },
    );

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    const hoja = await screen.findByRole('dialog');
    await userEvent.click(within(hoja).getByRole('button', { name: 'Confirmar 2' }));

    expect(await within(hoja).findByRole('alert')).toHaveTextContent('No se pudo confirmar');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(within(hoja).getByRole('button', { name: 'Confirmar 2' })).toBeEnabled();
    expect(toastSpy).not.toHaveBeenCalledWith(expect.stringMatching(/creadas?/), expect.anything());
  });

  it('el aviso de confirmadas reparte la cuenta por destino', () => {
    expect(
      avisoDeConfirmadas([
        { systemId: 'tesis', nombre: 'Tesis', cuenta: 2 },
        { systemId: null, nombre: 'Bandeja', cuenta: 1 },
      ]),
    ).toBe('3 tareas creadas: 2 en Tesis, 1 en Bandeja');
    expect(avisoDeConfirmadas([{ systemId: 'tesis', nombre: 'Tesis', cuenta: 1 }])).toBe('1 tarea creada en Tesis');
  });
});

describe('InboxView, lo que el servidor y el tiempo cambian bajo la fila', () => {
  afterEach(() => vi.useRealTimers());

  const TESIS = makeSystem({ id: mid('sys-1'), name: 'Tesis' });
  // La hoja sigue en el árbol mientras se cierra: lo que dice si está abierta es su estado.
  const hojaCerrada = () => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state') ?? 'closed').toBe('closed');
  const DOS = [{ title: 'Repasar el parcial' }, { title: 'Pedir la rúbrica' }];

  it('la fila tachada se queda aunque el servidor ya la cuente como hecha', async () => {
    const [tarea] = items(1);
    const convex = makeTestConvexClient([stubQuery(api.tasks.bySystem, [tarea!])]);
    renderMobile(<InboxView system={BANDEJA} initialTasks={[tarea!]} initialCaptures={[]} />, { convex });

    await userEvent.click(screen.getByRole('button', { name: 'Completar Cosa 1' }));
    act(() => convex.publish(stubQuery(api.tasks.bySystem, [{ ...tarea!, status: 'done' }])));

    expect(screen.getByRole('button', { name: 'Completar Cosa 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cosa 1')).toHaveClass('line-through');
  });

  it('tocar otra vez el círculo de una tachada la devuelve y retira su aviso', async () => {
    toastSpy.dismiss.mockClear();
    const [tarea] = items(1);
    const { convex } = renderMobile(<InboxView system={BANDEJA} initialTasks={[tarea!]} initialCaptures={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Completar Cosa 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Completar Cosa 1' }));

    expect(screen.getByRole('button', { name: 'Completar Cosa 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Cosa 1')).not.toHaveClass('line-through');
    expect(toastSpy.dismiss).toHaveBeenCalledWith('aviso');
    expect(convex.calls.filter((c) => c.name === 'tasks:toggle')).toHaveLength(2);
  });

  it('salir de Bandeja con un descarte pendiente lo manda, no lo pierde', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { convex, unmount } = renderMobile(
      <InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: null })]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartarla' }));
    expect(convex.calls.filter((c) => c.name === 'captures:descartar')).toHaveLength(0);

    unmount();

    expect(convex.calls.filter((c) => c.name === 'captures:descartar')).toEqual([
      { kind: 'mutation', name: 'captures:descartar', args: { id: 'cap-1' } },
    ]);
  });

  it('al confirmar con éxito la hoja se cierra', async () => {
    const convex = makeTestConvexClient([], [stubMutation(api.captures.confirmar, { creadas: 2 })]);
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: DOS })]} />, { convex });

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar 2' }));

    await vi.waitFor(hojaCerrada);
  });

  it('al confirmar, la hoja que se va sigue con su captura, no con «nadie la ha leído»', async () => {
    const convex = makeTestConvexClient([], [stubMutation(api.captures.confirmar, { creadas: 2 })]);
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: DOS })]} />, { convex });

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar 2' }));

    await vi.waitFor(hojaCerrada);
    const hoja = document.querySelector('[role="dialog"]');
    expect(hoja).not.toBeNull();
    expect(within(hoja as HTMLElement).getByText('2 tareas propuestas')).toBeInTheDocument();
    expect(screen.queryByText('Todavía nadie la ha leído')).toBeNull();
  });

  it('si confirmar falla cuando la hoja ya se cerró, un aviso lo dice', async () => {
    toastSpy.mockClear();
    let fallar: (error: Error) => void = () => {};
    const enVuelo = new Promise<never>((_, rechazar) => {
      fallar = rechazar;
    });
    const convex = makeTestConvexClient([], [{ name: getFunctionName(api.captures.confirmar), value: enVuelo }]);
    renderMobile(<InboxView system={BANDEJA} initialTasks={[]} initialCaptures={[captura({ proposedItems: DOS })]} />, { convex });

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar 2' }));
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(hojaCerrada);

    await act(async () => fallar(new Error('sin red')));

    expect(toastSpy).toHaveBeenCalledWith(expect.stringMatching(/No se pudo confirmar/));
  });

  it('las tareas que fueron a un solo sistema ofrecen abrirlo', async () => {
    toastSpy.mockClear();
    const convex = makeTestConvexClient(
      [stubQuery(api.systems.list, [BANDEJA, TESIS])],
      [stubMutation(api.captures.confirmar, { creadas: 2 })],
    );
    renderMobile(
      <InboxView
        system={BANDEJA}
        initialTasks={[]}
        initialCaptures={[captura({ proposedItems: DOS.map((item) => ({ ...item, systemId: TESIS.id })) })]}
      />,
      { convex },
    );

    await userEvent.click(screen.getByRole('button', { name: /https:\/\/react\.dev\/learn/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar 2' }));

    await vi.waitFor(() => expect(toastSpy.mock.calls.at(-1)?.[0]).toBe('2 tareas creadas en Tesis'));
    const { action } = toastSpy.mock.calls.at(-1)?.[1] as unknown as { action: { label: string; onClick: () => void } };
    expect(action.label).toBe('Abrir Tesis');
    action.onClick();
    expect(testRouter.push).toHaveBeenCalledWith(`/systems/${TESIS.id}`);
  });
});
