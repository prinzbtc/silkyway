'use client';

import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import Image from 'next/image';
import Link from 'next/link';
import { useWalletAuth } from '@/hooks/wallet/useWalletAuth';

interface UserProfile {
  username: string | null;
  avatar: string | null;
}

export const ConnectButton: FC = () => {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { signIn, signOut, isAuthenticating } = useWalletAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(async () => {
    try {
      await signOut();
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [signOut]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, []);

  useEffect(() => {
    const authenticate = async () => {
      if (connected && publicKey) {
        try {
          await signIn();
          // Wait a bit for the session to be established
          setTimeout(fetchUserProfile, 1000);
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    };
    authenticate();
  }, [connected, publicKey, signIn, fetchUserProfile]);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={handleConnect}
        disabled={isAuthenticating}
        className="px-4 py-2 font-semibold text-sm bg-white text-midnight dark:bg-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff] rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90 focus:outline-none focus:ring-2 focus:ring-midnight dark:focus:ring-[#ffffff] focus:ring-opacity-50 transition-colors border border-midnight dark:border-[#ffffff]"
      >
        {isAuthenticating ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-4 py-2 font-semibold text-sm bg-white text-midnight dark:bg-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff] rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90 focus:outline-none focus:ring-2 focus:ring-midnight dark:focus:ring-[#ffffff] focus:ring-opacity-50 transition-colors border border-midnight dark:border-[#ffffff]"
      >
        {userProfile?.avatar ? (
          <Image
            src={userProfile.avatar}
            alt="Profile"
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-midnight dark:bg-[#ffffff] rounded-full" />
        )}
        <span>{userProfile?.username || 'Anon'}</span>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] border border-midnight dark:border-[#ffffff] focus:outline-none">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-midnight dark:text-[#ffffff] hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90"
              onClick={() => setIsDropdownOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="block px-4 py-2 text-sm text-midnight dark:text-[#ffffff] hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90"
              onClick={() => setIsDropdownOpen(false)}
            >
              History
            </Link>
            <Link
              href="/inbox"
              className="block px-4 py-2 text-sm text-midnight dark:text-white hover:bg-gray-50 dark:hover:bg-background/80"
              onClick={() => setIsDropdownOpen(false)}
            >
              Inbox
            </Link>
            <button
              onClick={handleDisconnect}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-background/80"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
