"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SystemsTreeState {
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  setExpanded: (id: string, value: boolean) => void;
  setOnlyExpanded: (id: string) => void;
}

export const useSystemsTreeStore = create<SystemsTreeState>()(
  persist(
    (set) => ({
      expanded: {},
      toggle: (id) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
      setExpanded: (id, value) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: value } })),
      setOnlyExpanded: (id) =>
        set(() => ({ expanded: { [id]: true } })),
    }),
    {
      name: "kino-systems-tree",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
