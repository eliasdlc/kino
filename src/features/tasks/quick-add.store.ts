import { create } from "zustand";

interface QuickAddStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useQuickAddStore = create<QuickAddStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
