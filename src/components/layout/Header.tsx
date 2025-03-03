'use client';

import { FC } from 'react';
import Link from 'next/link';
import { ConnectButton } from '../wallet/ConnectButton';
import { CurrencySelector } from '../header/CurrencySelector';
import { SearchBar } from '../search/SearchBar';
import { NotificationBell } from '../notifications/NotificationBell';
import { ThemeToggle } from '../theme/ThemeToggle';

export const Header: FC = () => {
  return (
    <header className="bg-white dark:bg-[hsl(222.2,84%,4.9%)] shadow-sm dark:shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-midnight dark:text-[#ffffff] hover:text-midnight/90 dark:hover:text-[#ffffff] transition-colors">
              Silkyway
            </Link>

            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                href="/create" 
                className="text-sm font-medium text-midnight dark:text-[#ffffff] hover:text-midnight/90 dark:hover:text-[#ffffff] transition-colors"
              >
                Create Listing
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <SearchBar variant="minimal" className="max-w-xs" />
            <CurrencySelector />
            <ThemeToggle />
            <NotificationBell />
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
};
