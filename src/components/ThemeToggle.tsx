import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../store/themeStore';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting for mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-w-[44px] min-h-[44px]" />;

  const isDark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-ui-muted hover:text-ui-subtle hover:bg-ui-elevated transition-colors"
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
