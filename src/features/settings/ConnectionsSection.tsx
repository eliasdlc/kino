'use client';

import { Suspense } from 'react';
import { api } from '@convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';
import { useConvexQuery } from '@/shared/convex/hooks';
import { GithubConnectionSection } from '@/features/github-sync/GithubConnectionSection';

/**
 * Las fuentes conectadas, dentro de Ajustes hasta que haya una segunda.
 *
 * La lista sale del servidor y no de una constante del cliente, y eso es lo que
 * hace que aquí no se pinte nunca un proveedor sin código detrás: el schema
 * admite siete valores y sólo `github` tiene con qué responder, así que ofrecer
 * Jira o Slack sería un control muerto.
 */

/** Cómo se llama cada fuente en pantalla y quién pinta su panel. */
const PANEL: Record<string, () => React.ReactNode> = {
  github: () => (
    // Lee el resultado del callback de OAuth de la URL, así que necesita su
    // propio límite de Suspense.
    <Suspense>
      <GithubConnectionSection />
    </Suspense>
  ),
};

export function ConnectionsSection() {
  const { data: fuentes, isLoading } = useConvexQuery(api.connections.list, {});

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Conexiones</h2>
        <p className="text-sm text-muted-foreground">
          De dónde entra trabajo que no escribiste tú. Lo que traiga una fuente no pisa lo que
          añadas encima: la energía, la fecha y el plan de hoy siguen siendo tuyos.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : (
        (fuentes ?? []).map((fuente) => <div key={fuente.provider}>{PANEL[fuente.provider]?.()}</div>)
      )}
    </div>
  );
}
