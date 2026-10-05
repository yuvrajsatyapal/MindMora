"use client";
import { create } from "zustand";
/** Layout only: note selection belongs to the URL, drafts to the editor. */
export const useUiStore = create<{
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  reset: () => void;
}>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  reset: () => set({ sidebarOpen: true }),
}));
