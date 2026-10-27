'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { DESTINOS } from '@/components/navigation';

const nada = () => () => {};

/** ⌘ en un Mac y Ctrl en lo demás: `mod` en `useHotkey` acepta los dos. */
function useTeclaMod(): string {
  return useSyncExternalStore(
    nada,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}

function Luego() {
  return <span className="mx-1 text-xs text-muted-foreground">luego</span>;
}

/** Un atajo: qué hace a la izquierda, las teclas a la derecha. La misma fila con hairline que el índice. */
function Atajo({ label, keys }: { label: string; keys: ReactNode }) {
  return (
    <li className="flex min-h-[2.85rem] items-center justify-between gap-4 border-b border-border last:border-b-0">
      <span className="text-sm text-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-1">{keys}</span>
    </li>
  );
}

/**
 * Los atajos de teclado, en su hoja y sólo en escritorio: en el teléfono no
 * hay teclado que atajar. Los de ir a un destino salen de la lista única de
 * destinos (`navigation.ts`), la misma que lee `GlobalNavigationShortcuts`,
 * así que esta hoja no puede decir Inbox ni Dashboard cuando el pie dice
 * Bandeja y Hoy.
 */
export function ShortcutsSection() {
  const mod = useTeclaMod();
  return (
    <ul className="pl-(--margen)">
      <Atajo label="Abrir la paleta de comandos" keys={<><Kbd>{mod}</Kbd><Kbd>K</Kbd></>} />
      <Atajo label="Añadir una tarea a la Bandeja" keys={<><Kbd>{mod}</Kbd><Kbd>I</Kbd></>} />
      {DESTINOS.map((d) => (
        <Atajo
          key={d.href}
          label={`Ir a ${d.label}`}
          keys={<><Kbd>G</Kbd><Luego /><Kbd>{d.tecla.toUpperCase()}</Kbd></>}
        />
      ))}
      <Atajo label="Subir y bajar entre tareas" keys={<><Kbd>J</Kbd><Kbd>K</Kbd></>} />
      <Atajo label="Completar la tarea elegida" keys={<><Kbd>Espacio</Kbd><span className="mx-1 text-xs text-muted-foreground">o</span><Kbd>E</Kbd></>} />
      <Atajo label="Abrir su detalle" keys={<Kbd>Intro</Kbd>} />
      <Atajo label="Borrarla, con confirmación" keys={<Kbd>Retroceso</Kbd>} />
    </ul>
  );
}
