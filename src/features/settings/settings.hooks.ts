import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UserSettings } from './settings.service';
import type { UpdateUserSettingsInput } from './settings.schemas';

export const userSettingsKey = () => ['user-settings'] as const;

export function useUserSettings() {
  return useQuery<UserSettings>({
    queryKey: userSettingsKey(),
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('No se pudieron cargar los ajustes');
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateUserSettingsInput) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('No se pudieron guardar los ajustes');
      return res.json() as Promise<UserSettings>;
    },
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
