'use client';

import { FC, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

export const SearchBar: FC = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router]);

  const handleClear = useCallback(() => {
    setQuery('');
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-2xl">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-midnight dark:text-[hsl(222.2,84%,4.9%)]" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search listings..."
          className="block w-full pl-10 pr-10 py-2 border border-midnight dark:border-[#ffffff] rounded-md leading-5 bg-white dark:bg-[#ffffff] placeholder-midnight/60 dark:placeholder-[hsl(222.2,84%,4.9%)]/60 text-midnight dark:text-[hsl(222.2,84%,4.9%)] focus:outline-none focus:placeholder-midnight/80 dark:focus:placeholder-[hsl(222.2,84%,4.9%)]/80 focus:ring-1 focus:ring-midnight dark:focus:ring-[#ffffff] focus:border-midnight dark:focus:border-[#ffffff] sm:text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-5 w-5 text-midnight dark:text-[hsl(222.2,84%,4.9%)] hover:text-midnight/80 dark:hover:text-[hsl(222.2,84%,4.9%)]/80" />
          </button>
        )}
      </div>
    </form>
  );
};
