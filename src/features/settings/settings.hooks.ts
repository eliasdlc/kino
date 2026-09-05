import { toast } from 'sonner';
import { api } from '@convex/_generated/api';
import { useConvexMutation, useConvexQuery, useLocalMutation } from '@/shared/convex/hooks';
import { downloadBlob } from '@/shared/utils/download';

export function useUserSettings() {
  return useConvexQuery(api.settings.get, {});
}

export function useUpdateUserSettings() {
  return useConvexMutation(api.settings.update, {
    onSuccess: () => toast.success('Ajustes guardados'),
    onError: () => toast.error('No se pudieron guardar los ajustes'),
  });
}

/**
 * Genera y descarga el ZIP del workspace completo.
 *
 * Es una mutación y no una query porque el usuario la dispara y porque el
 * `isPending` es la mitad del valor: recorrer todos los sistemas, páginas y
 * carpetas y bajar cada imagen tarda, y sin señal de progreso la gente vuelve
 * a pulsar y encadena invocaciones caras.
 */
export function useExportWorkspace() {
  return useLocalMutation(
    async () => {
      const res = await fetch('/api/export/workspace');
      if (!res.ok) throw new Error('No se pudo generar el export');
      // El export nunca falla por una imagen: las que no cupieron en el
      // presupuesto se quedan apuntando a su URL remota, y avisarlo es
      // preferible a que el usuario lo descubra abriendo el ZIP.
      const skipped = Number(res.headers.get('X-Kino-Images-Skipped') ?? 0);
      downloadBlob(await res.blob(), 'kino-workspace.zip');
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
        toast.success('Export listo');
      },
      onError: () => {
        toast.error('No se pudo generar el export');
      },
    },
  );
}
