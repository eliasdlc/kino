import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { System, CreateSystemInput } from "./systems.types";

export function useSystems() {
  return useQuery<System[]>({
    queryKey: ["systems"],
    queryFn: async () => {
      const res = await fetch("/api/systems");
      if (!res.ok) throw new Error("Failed to fetch systems");
      return res.json();
    },
  });
}

export function useCreateSystem() {
  const queryClient = useQueryClient();

  return useMutation<System, Error, CreateSystemInput>({
    mutationFn: async (data) => {
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create system");
      }
      return res.json() as Promise<System>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}
