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
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKey(), data);
      toast.success('Ajustes guardados');
    },
    onError: () => {
      toast.error('No se pudieron guardar los ajustes');
    },
  });
}
