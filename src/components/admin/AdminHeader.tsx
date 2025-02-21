'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ConnectButton } from '@/components/wallet/ConnectButton';

export function AdminHeader() {
  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center space-x-2">
            <Image
              src="/logo.png"
              alt="Silkyway Logo"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="text-xl font-bold text-gray-900">
              Silkyway Admin Dashboard
            </span>
          </Link>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
