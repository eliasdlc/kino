'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AccountOverview, ActiveSession } from './account.service';
import type { ChangeEmailInput, ChangePasswordInput, DeleteAccountInput } from './account.schemas';
import { api } from '@/shared/api/client';
import { useOptimisticList } from '@/shared/hooks/optimistic';

/** Las fechas viajan como ISO por JSON. */
export type ActiveSessionDto = Omit<ActiveSession, 'createdAt' | 'lastActiveAt'> & {
  createdAt: string;
  lastActiveAt: string;
};

export const accountKeys = {
  overview: ['account'] as const,
  sessions: ['account', 'sessions'] as const,
};

/** Mensaje del cuerpo de error de la API, o el de respaldo si no trae uno. */
export function useAccount() {
  return useQuery<AccountOverview>({
    queryKey: accountKeys.overview,
    queryFn: async () => {
      return api.account.overview({});
    },
    staleTime: 60_000,
  });
}

export function useRenameAccount() {
  const qc = useQueryClient();
  return useMutation<AccountOverview, Error, string>({
    mutationFn: async (name) => {
      return api.account.rename({ name });
    },
    onSuccess: (data) => {
      qc.setQueryData(accountKeys.overview, data);
      toast.success('Nombre guardado');
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation<void, Error, ChangePasswordInput>({
    mutationFn: async (input) => {
      await api.account.changePassword(input);
    },
    // Cambiarla cierra las demás sesiones: la lista tiene que reflejarlo.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountKeys.sessions });
      toast.success('Contraseña cambiada. Las demás sesiones se cerraron.');
    },
  });
}

export function useRequestEmailChange() {
  return useMutation<void, Error, ChangeEmailInput>({
    mutationFn: async (input) => {
      await api.account.changeEmail(input);
    },
  });
}

export function useSessions() {
  return useQuery<ActiveSessionDto[]>({
    queryKey: accountKeys.sessions,
    queryFn: async () => {
      return api.account.sessions({});
    },
  });
}

export function useRevokeSession() {
  return useOptimisticList<void, Error, string, ActiveSessionDto>({
    mutationFn: (id) => api.account.revokeSession({ id }),
    queryKey: accountKeys.sessions,
    updater: (sessions, id) => sessions.filter((s) => s.id !== id),
    onError: (error) => toast.error(error.message),
  });
}

export function useRevokeOtherSessions() {
  return useOptimisticList<{ revoked: number }, Error, void, ActiveSessionDto>({
    mutationFn: () => api.account.revokeOtherSessions({}),
    queryKey: accountKeys.sessions,
    updater: (sessions) => sessions.filter((s) => s.current),
    onSuccess: ({ revoked }) =>
      toast.success(revoked === 1 ? 'Se cerró 1 sesión' : `Se cerraron ${revoked} sesiones`),
    onError: (error) => toast.error(error.message),
  });
}

export function useDeleteAccount() {
  return useMutation<void, Error, DeleteAccountInput>({
    mutationFn: async (input) => {
      await api.account.remove(input);
    },
  });
}
