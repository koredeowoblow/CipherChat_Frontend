import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

const applyTheme = (theme: Theme) => {
  if (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const useThemeStore = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('cipherchat-theme') as Theme) || 'dark', // default to dark
  setTheme: (theme: Theme) => {
    localStorage.setItem('cipherchat-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  initializeTheme: () => {
    const theme = (localStorage.getItem('cipherchat-theme') as Theme) || 'dark';
    applyTheme(theme);
    
    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const currentTheme = localStorage.getItem('cipherchat-theme') as Theme || 'dark';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  },
}));

export default useThemeStore;
