'use client';

import { FC, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const ThemeToggle: FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme as 'light' | 'dark');
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (systemPrefersDark) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-midnight dark:border-[#ffffff] hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90 transition-colors bg-white dark:bg-[hsl(222.2,84%,4.9%)]"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-midnight" />
      ) : (
        <Sun className="w-5 h-5 text-[#ffffff]" />
      )}
    </button>
  );
};
