"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SystemsTreeState {
  expanded: Record<string, boolean>;
  sidebarCollapsed: boolean;
  pinnedIds: string[];
  toggle: (id: string) => void;
  setExpanded: (id: string, value: boolean) => void;
  setOnlyExpanded: (id: string) => void;
  toggleSidebar: () => void;
  togglePin: (id: string) => void;
}

export const useSystemsTreeStore = create<SystemsTreeState>()(
  persist(
    (set) => ({
      expanded: {},
      sidebarCollapsed: false,
      pinnedIds: [],
      toggle: (id) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
      setExpanded: (id, value) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: value } })),
      setOnlyExpanded: (id) =>
        set(() => ({ expanded: { [id]: true } })),
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      togglePin: (id) =>
        set((s) => ({
          pinnedIds: s.pinnedIds.includes(id)
            ? s.pinnedIds.filter((p) => p !== id)
            : [...s.pinnedIds, id],
        })),
    }),
    {
      name: "kino-systems-tree",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
