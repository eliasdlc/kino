import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  return useMutation({
    mutationFn: (input: UpdateUserSettingsInput) => api.settings.update(input),
    // Patrón optimista canónico: el control refleja la elección al instante y
    // vuelve atrás si el servidor la rechaza. Sin esto un Select se queda
    // pintando el valor viejo hasta que responde el PATCH.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKey() });
      const prev = queryClient.getQueryData<UserSettings>(userSettingsKey());
      if (prev) {
        queryClient.setQueryData<UserSettings>(userSettingsKey(), { ...prev, ...input });
      }
      return { prev };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKey(), data);
      toast.success('Ajustes guardados');
    },
    onError: (_err, _input, context) => {
      if (context?.prev) queryClient.setQueryData(userSettingsKey(), context.prev);
      toast.error('No se pudieron guardar los ajustes');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: userSettingsKey() });
    },
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
