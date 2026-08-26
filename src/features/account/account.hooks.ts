'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AccountOverview, ActiveSession } from './account.service';
import type { ChangeEmailInput, ChangePasswordInput, DeleteAccountInput } from './account.schemas';
import { api } from '@/shared/api/client';

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
  const qc = useQueryClient();
  return useMutation<void, Error, string, { prev?: ActiveSessionDto[] }>({
    mutationFn: async (id) => {
      await api.account.revokeSession({ id });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: accountKeys.sessions });
      const prev = qc.getQueryData<ActiveSessionDto[]>(accountKeys.sessions);
      qc.setQueryData<ActiveSessionDto[]>(accountKeys.sessions, (old = []) => old.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (error, _id, context) => {
      if (context?.prev) qc.setQueryData(accountKeys.sessions, context.prev);
      toast.error(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: accountKeys.sessions });
    },
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation<{ revoked: number }, Error, void, { prev?: ActiveSessionDto[] }>({
    mutationFn: async () => {
      return api.account.revokeOtherSessions({});
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: accountKeys.sessions });
      const prev = qc.getQueryData<ActiveSessionDto[]>(accountKeys.sessions);
      qc.setQueryData<ActiveSessionDto[]>(accountKeys.sessions, (old = []) => old.filter((s) => s.current));
      return { prev };
    },
    onSuccess: ({ revoked }) => {
      toast.success(revoked === 1 ? 'Se cerró 1 sesión' : `Se cerraron ${revoked} sesiones`);
    },
    onError: (error, _input, context) => {
      if (context?.prev) qc.setQueryData(accountKeys.sessions, context.prev);
      toast.error(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: accountKeys.sessions });
    },
  });
}

export function useDeleteAccount() {
  return useMutation<void, Error, DeleteAccountInput>({
    mutationFn: async (input) => {
      await api.account.remove(input);
    },
  });
}
