import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOptimisticRecord } from '@/shared/hooks/optimistic';
import { toast } from 'sonner';
import { downloadBlob } from '@/shared/utils/download';
import { api } from '@/shared/api/client';
import type { UserSettings } from './settings.service';
import type { UpdateUserSettingsInput } from './settings.schemas';

export const userSettingsKey = () => ['user-settings'] as const;

export function useUserSettings() {
  return useQuery({
    queryKey: userSettingsKey(),
    queryFn: () => api.settings.get({}),
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useOptimisticRecord<UserSettings, Error, UpdateUserSettingsInput, UserSettings>({
    mutationFn: (input) => api.settings.update(input),
    queryKey: userSettingsKey(),
    updater: (previous, input) => ({ ...previous, ...input }),
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKey(), data);
      toast.success('Ajustes guardados');
    },
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
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/export/workspace');
      if (!res.ok) throw new Error('No se pudo generar el export');
      // El export nunca falla por una imagen: las que no cupieron en el
      // presupuesto se quedan apuntando a su URL remota, y avisarlo es
      // preferible a que el usuario lo descubra abriendo el ZIP.
      const skipped = Number(res.headers.get('X-Kino-Images-Skipped') ?? 0);
      downloadBlob(await res.blob(), 'kino-workspace.zip');
      return { skipped };
    },
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
  });
}
