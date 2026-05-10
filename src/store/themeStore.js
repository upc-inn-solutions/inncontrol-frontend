import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  dark: localStorage.getItem('theme') !== 'light', // default dark

  toggleTheme: () =>
    set((state) => {
      const next = !state.dark;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return { dark: next };
    }),

  setDark: (val) => {
    localStorage.setItem('theme', val ? 'dark' : 'light');
    set({ dark: val });
  },
}));
