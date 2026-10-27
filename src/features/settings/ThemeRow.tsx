'use client';

import { useId, useSyncExternalStore } from 'react';
import { SunMoon } from 'lucide-react';
import { MarginRow } from '@/components/ui/margin-row';
import { Segmented } from '@/components/ui/segmented';
import { useThemeStore, type ThemeMode } from '@/components/ThemeProvider';
import { Pendiente } from './settings-ui';
import { useUpdateUserSettings } from './settings.hooks';

const OPCIONES: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

const OSCURO = '(prefers-color-scheme: dark)';

function suscribir(avisar: () => void) {
  const mql = window.matchMedia(OSCURO);
  mql.addEventListener('change', avisar);
  return () => mql.removeEventListener('change', avisar);
}

/** El tema que el dispositivo pide ahora. En el servidor no se sabe: null. */
function useSistemaOscuro(): boolean | null {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(OSCURO).matches,
    () => null,
  );
}

/**
 * Lo que dice la línea de debajo del segmento. Sale del mismo valor que
 * marca el segmento y, con Sistema, del tema que el dispositivo pide en este
 * momento, así que nunca puede decir "sigue al sistema" con Oscuro marcado.
 */
export function textoTema(modo: ThemeMode, sistemaOscuro: boolean | null): string | undefined {
  if (modo === 'light') return 'Siempre claro en este dispositivo';
  if (modo === 'dark') return 'Siempre oscuro en este dispositivo';
  if (sistemaOscuro === null) return undefined;
  return `Sigue al dispositivo: ahora ${sistemaOscuro ? 'oscuro' : 'claro'}`;
}

/**
 * El tema como segmento en tinta, en línea en el índice: un toque, y no los
 * cinco del select de antes. Aplica al instante en este dispositivo y viaja a
 * la cuenta para el siguiente que estrene. El segmento y la línea de debajo
 * esperan a saber qué eligió este dispositivo: ni marcan Sistema por defecto
 * ni contradicen lo elegido un instante.
 */
export function ThemeRow() {
  const mode = useThemeStore((s) => s.mode);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setMode = useThemeStore((s) => s.setMode);
  const sistemaOscuro = useSistemaOscuro();
  const { mutate } = useUpdateUserSettings();
  const tituloId = useId();
  const texto = hydrated ? textoTema(mode, sistemaOscuro) : undefined;

  function elegir(next: ThemeMode) {
    setMode(next);
    mutate({ theme: next });
  }

  return (
    <MarginRow margin={<SunMoon aria-hidden className="mt-[0.5rem] size-5 stroke-[1.8] @min-[20.2rem]:mt-[1.4rem]" />} className="@container">
      {/* El segmento va en el renglón del título cuando la fila mide 20.2rem o
          más (393 px de pantalla); en un teléfono más estrecho, debajo. Lo
          decide una consulta de contenedor y no lo que salga de envolver, así
          que el esqueleto, con las mismas clases, cambia en el mismo punto y
          la fila no salta al cargar. */}
      <span data-slot="theme-row-line" className="flex flex-col items-start gap-2 @min-[20.2rem]:flex-row @min-[20.2rem]:items-center @min-[20.2rem]:justify-between @min-[20.2rem]:gap-3">
        <span id={tituloId} className="text-base leading-6 font-semibold text-foreground">
          Tema
        </span>
        {/* Antes de saber qué eligió este dispositivo el store dice "system"
            por defecto: marcarlo haría saltar el segmento de Sistema al valor
            real en cada carga. Mientras tanto, la pastilla del mismo tamaño
            que deja el esqueleto. */}
        {hydrated ? (
          <Segmented aria-labelledby={tituloId} value={mode} onValueChange={elegir} options={OPCIONES} />
        ) : (
          <Pendiente className="h-[3.35rem] w-[13.9rem] rounded-full" />
        )}
      </span>
      <span data-slot="settings-meta" aria-live="polite" className="mt-1 block h-5 truncate text-sm leading-5 text-muted-foreground">
        {texto ?? <Pendiente className="w-48" />}
      </span>
    </MarginRow>
  );
}
