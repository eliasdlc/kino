import { useQuery } from "@tanstack/react-query";
import { System } from "./systems.types";

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
