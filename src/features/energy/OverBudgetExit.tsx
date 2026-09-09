'use client';

import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';
import { useMoveToTomorrow } from '@/features/tasks/tasks.hooks';
import { userTomorrow } from '@/shared/time';

/**
 * El día no cabe.
 *
 * Es el momento más difícil del producto después del techo apagado, y hasta
 * ahora lo decía una frase que presentaba a Kino como una autoridad que elige
 * no ejercerse. Aquí el sujeto de la frase es el día y la cifra va delante.
 *
 * Tres cosas que este bloque **no** hace:
 *
 *  * No dice que acabas de pasarte. El plan se repuebla al leerlo y el ritual
 *    reparte a medianoche, así que un sobregiro del martes puede no venir de
 *    ningún gesto del martes.
 *  * No lleva botón de dejarlo así. Se cableaba a una operación que no existe y
 *    su estado vivía en memoria del componente: un botón que no recuerda es una
 *    mentira pequeña todos los días. El bloque se va cuando el día deja de estar
 *    en sobregiro, no cuando alguien lo silencia, así que no hay nada que acusar.
 *  * No usa rojo. El rojo queda para lo irreversible y pasarse del techo del día
 *    no lo es: el sobregiro es el acento, y lo que lo distingue de un día normal
 *    es la palabra.
 */
export function OverBudgetExit() {
  const { data: exit } = useConvexQuery(api.energy.overBudgetExit, {});
  const { mutate: moveToTomorrow, isPending } = useMoveToTomorrow();

  if (!exit) return null;

  function moverLasTres() {
    if (!exit) return;
    const tomorrow = userTomorrow(Intl.DateTimeFormat().resolvedOptions().timeZone);
    for (const task of exit.mover) moveToTomorrow({ taskId: task.id, tomorrow });
  }

  return (
    <section
      aria-labelledby="sobregiro"
      className="space-y-3 rounded-2xl border border-primary bg-primary/8 p-4"
    >
      <p id="sobregiro" className="font-display text-xl font-bold tracking-[-0.02em] text-primary">
        El día queda en {exit.committed} de {exit.limit} puntos.
      </p>

      {exit.mover.length > 0 && (
        <>
          <p className="text-sm text-foreground/80">
            Estas {exit.mover.length === 1 ? 'es la que menos urgencia tiene' : `${exit.mover.length} son las que menos urgencia tienen`}.
          </p>
          <ul className="space-y-1">
            {exit.mover.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {task.points} pt
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={moverLasTres}
            disabled={isPending}
            className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {isPending
              ? 'Moviendo'
              : `Mover ${exit.mover.length === 1 ? 'la' : `las ${exit.mover.length}`} a mañana`}
          </button>
        </>
      )}
    </section>
  );
}
