'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { AccountOverview } from './account.service';
import type { DeleteAccountInput } from './account.schemas';
import { api } from '@/shared/api/client';

export const accountKeys = {
  overview: ['account'] as const,
};

export function useAccount() {
  return useQuery<AccountOverview>({
    queryKey: accountKeys.overview,
    queryFn: async () => api.account.overview({}),
    staleTime: 60_000,
  });
}

export function useDeleteAccount() {
  return useMutation<void, Error, DeleteAccountInput>({
    mutationFn: async (input) => {
      await api.account.remove(input);
    },
  });
}
