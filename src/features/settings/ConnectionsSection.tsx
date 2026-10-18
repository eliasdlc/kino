'use client';

import { Suspense } from 'react';
import { api } from '@convex/_generated/api';
import { useConvexQuery } from '@/shared/convex/hooks';
import { GithubConnectionSection } from '@/features/github-sync/GithubConnectionSection';
import { enPantalla } from '@/features/connections/providers';
import { SheetLoading } from './settings-ui';

/**
 * Las fuentes conectadas, en su hoja de Ajustes hasta que haya una segunda.
 *
 * La lista sale del servidor y no de una constante del cliente, y eso es lo que
 * hace que aquí no se pinte nunca un proveedor sin código detrás: el schema
 * admite siete valores y sólo `github` tiene con qué responder, así que ofrecer
 * Jira o Slack sería un control muerto. El registro de proveedores lo filtra
 * otra vez: una fuente que el servidor conoce pero no responde no se pinta.
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

const NOMBRE: Record<string, string> = { github: 'GitHub' };

/** Las fuentes que se pintan, con la misma lista que la hoja. */
function useFuentes() {
  const { data } = useConvexQuery(api.connections.list, {});
  return data?.filter((fuente) => enPantalla(fuente.provider));
}

/**
 * La meta de la fila del índice: qué fuente hay y si está conectada. Sale de
 * la misma query que la hoja, no de la acción que pregunta a GitHub, así que
 * abrir Ajustes no llama a nadie fuera.
 */
export function useConnectionsMeta(): string | undefined {
  const fuentes = useFuentes();
  if (!fuentes) return undefined;
  if (fuentes.length === 0) return 'Ninguna fuente disponible';
  return fuentes
    .map((f) => `${NOMBRE[f.provider] ?? f.provider}, ${f.connected ? 'conectada' : 'sin conectar'}`)
    .join('; ');
}

export function ConnectionsSection() {
  const fuentes = useFuentes();

  if (!fuentes) return <SheetLoading rows={2} />;
  return (
    <div className="space-y-4 pl-(--margen)">
      {fuentes.map((fuente) => (
        <div key={fuente.provider}>{PANEL[fuente.provider]?.()}</div>
      ))}
    </div>
  );
}

/** Lo que la hoja explica arriba, con la misma frase que antes llevaba la sección. */
export const CONEXIONES_DESCRIPCION =
  'De dónde entra trabajo que no escribiste tú. Lo que traiga una fuente no pisa lo que añadas encima: la energía, la fecha y el plan de hoy siguen siendo tuyos.';
