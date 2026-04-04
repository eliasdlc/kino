import { useQuery } from "@tanstack/react-query";

export function useSystems() {
  return useQuery({
    queryKey: ["systems"],
    queryFn: async () => {
      const res = await fetch("/api/systems");
      if (!res.ok) throw new Error("Failed to fetch systems");
      return res.json();
    },
  });
}   
