import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import { useConvexMutation, useConvexQuery, useLocalMutation } from '@/shared/convex/hooks';
import { downloadBlob } from '@/shared/utils/download';

export function useUserSettings() {
  return useConvexQuery(api.settings.get, {});
}

/**
 * El contrato de guardado de Ajustes: todo guarda al tocar. No hay aviso de
 * éxito, porque el control ya enseña el valor nuevo y deshacer es volver a
 * tocarlo; un toast por cada paso del límite o cada opción del tema sería
 * ruido. Sólo se avisa cuando no se guardó, y entonces el control vuelve al
 * valor de la cuenta.
 */
export function useUpdateUserSettings() {
  return useConvexMutation(api.settings.update, {
    onError: () => toast.error('No se pudieron guardar los ajustes'),
  });
}

/**
 * El perfil de energía con el mismo contrato que el resto de Ajustes: cada
 * campo se guarda al tocarlo y sin toast de éxito. No usa
 * `useUpdateEnergyProfile` de energía porque ese avisa en cada guardado, que
 * es lo justo para un formulario con botón y demasiado para un control que
 * guarda en cada toque.
 */
export function useSaveEnergyProfile() {
  return useConvexMutation(api.energy.updateProfile, {
    onError: () => toast.error('No se pudo guardar tu perfil de energía'),
  });
}

/**
 * Genera y descarga el ZIP de datos del workspace.
 *
 * Es una mutación y no una query porque el usuario la dispara y porque el
 * `isPending` es la mitad del valor: recorrer las veintidós tablas tarda, y sin
 * señal de progreso la gente vuelve a pulsar y encadena invocaciones caras.
 *
 * Las imágenes viajan en su propio ZIP (`useExportImages`): juntas ya no caben
 * en el presupuesto de la ruta.
 */
export function useExportWorkspace() {
  return useLocalMutation(
    async () => {
      const res = await fetch('/api/export/workspace');
      if (!res.ok) throw new Error('No se pudo generar el export');
      // Una tabla que llegó al tope viaja recortada, y decirlo aquí es mejor
      // que dejar que se descubra comparando el JSON con la app.
      const recortadas = res.headers.get('X-Kino-Truncated') ?? 'none';
      downloadBlob(await res.blob(), 'kino-workspace.zip');
      return { recortadas: recortadas === 'none' ? [] : recortadas.split(',') };
    },
    {
      onSuccess: ({ recortadas }) => {
        if (recortadas.length > 0) {
          toast.warning(`El export salió recortado en: ${recortadas.join(', ')}. El manifiesto del ZIP lo dice.`);
          return;
        }
        toast.success('Export listo');
      },
      onError: () => {
        toast.error('No se pudo generar el export');
      },
    },
  );
}

/** El segundo ZIP: las imágenes, para descomprimir al lado del de datos. */
export function useExportImages() {
  return useLocalMutation(
    async () => {
      const res = await fetch('/api/export/images');
      if (!res.ok) throw new Error('No se pudieron bajar las imágenes');
      // El export nunca falla por una imagen: las que no cupieron en el
      // presupuesto se quedan apuntando a su URL remota, y avisarlo es
      // preferible a que se descubra abriendo el ZIP.
      const skipped = Number(res.headers.get('X-Kino-Images-Skipped') ?? 0);
      downloadBlob(await res.blob(), 'kino-imagenes.zip');
      return { skipped };
    },
    {
      onSuccess: ({ skipped }) => {
        if (skipped > 0) {
          toast.warning(
            `${skipped} ${skipped === 1 ? 'imagen quedó fuera' : 'imágenes quedaron fuera'} del ZIP y siguen apuntando a su URL original.`,
          );
          return;
        }
        toast.success('Imágenes listas');
      },
      onError: () => {
        toast.error('No se pudieron bajar las imágenes');
      },
    },
  );
}
