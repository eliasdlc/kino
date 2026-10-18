'use client';

import { Suspense } from 'react';
import { GitBranch } from 'lucide-react';
import { GithubConnectionSection } from '@/features/github-sync/GithubConnectionSection';
import { IndexRow, SheetLoading } from './settings-ui';
import { useEstadoGithub, useFuentes } from './settings.hooks';

/**
 * Las fuentes conectadas, en su hoja de Ajustes hasta que haya una segunda.
 *
 * La lista sale del servidor y no de una constante del cliente, y eso es lo que
 * hace que aquí no se pinte nunca un proveedor sin código detrás: el schema
 * admite siete valores y sólo `github` tiene con qué responder, así que ofrecer
 * Jira o Slack sería un control muerto. El registro de proveedores lo filtra
 * otra vez: una fuente que el servidor conoce pero no responde no se pinta.
 *
 * GitHub sale del mismo estado que la fila del índice. Si este despliegue no
 * tiene la integración, la hoja lo dice en una fila y no abre el panel de
 * conectar, que sin ella sería una caja sin botón.
 */
export function ConnectionsSection() {
  const fuentes = useFuentes();
  const github = useEstadoGithub();

  if (!fuentes) return <SheetLoading rows={2} />;
  return (
    <div className="space-y-4">
      {fuentes.map((fuente) => {
        if (fuente.provider !== 'github') return null;
        if (github === undefined) return <SheetLoading key={fuente.provider} rows={1} />;
        if (github === 'no-disponible') {
          return (
            <IndexRow
              key={fuente.provider}
              icon={<GitBranch aria-hidden className="size-5 stroke-[1.8]" />}
              title="GitHub"
              meta="No disponible en esta instalación: falta configurar la integración en el servidor. Cuando esté, aquí se conecta la cuenta."
              wrap
            />
          );
        }
        return (
          // El panel lee el resultado del OAuth de la URL: su propio límite de Suspense.
          <div key={fuente.provider} className="pl-(--margen)">
            <Suspense>
              <GithubConnectionSection />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
