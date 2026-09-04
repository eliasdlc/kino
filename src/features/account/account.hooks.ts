'use client';

import { api } from '@convex/_generated/api';
import { useConvexAction, useConvexQuery } from '@/shared/convex/hooks';

export function useAccount() {
  return useConvexQuery(api.users.current, {});
}

export function useDeleteAccount() {
  return useConvexAction(api.account.remove);
}
