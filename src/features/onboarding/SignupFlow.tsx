'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button } from '@/components/ui/button';
import { track } from '@/shared/observability/analytics.client';
import { TrackOnMount } from '@/shared/observability/TrackOnMount';
import { ArchetypeGallery } from './ArchetypeGallery';
import { DEFAULT_IDENTITY, type ArchetypeIdentity } from './onboarding.archetypes';

/**
 * El alta: dos pantallas y una pregunta. Esta es la primera; la segunda es Hoy,
 * con el plan ya sembrado, y por eso no existe como componente.
 *
 * Lo que sustituye tenía ocho pasos, y cuatro de ellos eran perfil de energía
 * (cronotipo, horas de sueño, qué te recarga, horas disponibles). Los cuatro
 * salieron del camino: un perfil declarado el día 1 es una suposición, y Kino
 * mide en vez de suponer. Viven en Ajustes, y el momento en que el producto
 * vuelve a preguntar el cronotipo (con la curva medida delante) lo decide el
 * motor de energía a los catorce días.
 *
 * "Entrar" está activo desde el primer momento: hay un arquetipo por defecto y
 * ninguna pantalla que validar. Nadie se queda mirando un botón apagado sin
 * saber qué le falta.
 *
 * No usa TanStack Query a propósito: el alta no tiene nada que cachear.
 */
export function SignupFlow({
  initialIdentity = null,
  segment = null,
}: {
  initialIdentity?: ArchetypeIdentity | null;
  /** Slug de la landing por la que se entró, ya validado. La dimensión del funnel. */
  segment?: string | null;
}) {
  const router = useRouter();
  const completeOnboarding = useMutation(api.onboarding.complete);
  const [identity, setIdentity] = useState<ArchetypeIdentity>(initialIdentity ?? DEFAULT_IDENTITY);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Elegir es el único abandono que queda dentro del alta (elegir y no entrar),
  // así que es lo que se mide. Una vez por identidad distinta: el arquetipo con
  // el que arranca la pantalla no es una elección, y contarlo aplanaría el embudo.
  const chosen = useRef<ArchetypeIdentity | null>(initialIdentity);
  function choose(next: ArchetypeIdentity) {
    setIdentity(next);
    if (chosen.current === next) return;
    chosen.current = next;
    track('archetype_chosen', { segment, identity: next });
  }

  async function enter() {
    setIsLoading(true);
    setError(null);
    try {
      // Una sola escritura: perfil de energía con sus defaults, zona horaria del
      // navegador, el sistema con el nombre de su arquetipo y la siembra.
      await completeOnboarding({
        identity,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      track('onboarding_completed', { segment, identity });
      router.push('/dashboard');
    } catch {
      setIsLoading(false);
      setError('Algo salió mal, intenta de nuevo.');
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 p-5">
      <TrackOnMount event="onboarding_started" properties={{ segment }} />

      <header className="shrink-0">
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-[-0.03em]">
          ¿En qué trabajas?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Una sola pregunta. Lo demás lo mide Kino.
        </p>
      </header>

      <ArchetypeGallery value={identity} onChange={choose} />

      {error && (
        <p role="alert" className="shrink-0 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        onClick={enter}
        disabled={isLoading}
        className="h-[3.2rem] shrink-0 rounded-full text-base font-bold"
      >
        {isLoading ? 'Armando tu día' : 'Entrar'}
      </Button>
    </div>
  );
}
