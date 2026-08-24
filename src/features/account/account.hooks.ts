'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AccountOverview, ActiveSession } from './account.service';
import type { ChangeEmailInput, ChangePasswordInput, DeleteAccountInput } from './account.schemas';

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
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message;
    }
  } catch {
    // Sin cuerpo JSON: vale el de respaldo.
  }
  return fallback;
}

export function useAccount() {
  return useQuery<AccountOverview>({
    queryKey: accountKeys.overview,
    queryFn: async () => {
      const res = await fetch('/api/account');
      if (!res.ok) throw new Error('No se pudo cargar la cuenta');
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useRenameAccount() {
  const qc = useQueryClient();
  return useMutation<AccountOverview, Error, string>({
    mutationFn: async (name) => {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo guardar el nombre'));
      return res.json();
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
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cambiar la contraseña'));
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
      const res = await fetch('/api/account/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo pedir el cambio de correo'));
    },
  });
}

export function useSessions() {
  return useQuery<ActiveSessionDto[]>({
    queryKey: accountKeys.sessions,
    queryFn: async () => {
      const res = await fetch('/api/account/sessions');
      if (!res.ok) throw new Error('No se pudieron cargar las sesiones');
      return res.json();
    },
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { prev?: ActiveSessionDto[] }>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/account/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo cerrar la sesión'));
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
      const res = await fetch('/api/account/sessions/revoke-others', { method: 'POST' });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudieron cerrar las sesiones'));
      return res.json();
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
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await errorMessage(res, 'No se pudo borrar la cuenta'));
    },
  });
}
