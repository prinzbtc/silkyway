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
  
  const truncateAddress = (address: string | null) => {
    if (!address) return 'Anon';
    return `${address.substring(0, 5)}...`;
  };
  const { setVisible } = useWalletModal();
  const { signIn, signOut, isAuthenticating } = useWalletAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

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

  // Calculate dropdown position when it opens or window resizes
  const updateDropdownPosition = useCallback(() => {
    if (isDropdownOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 160; // Approximate height of dropdown
      const dropdownWidth = 192; // Width of dropdown (48 * 4)
      
      // Check if dropdown would go off bottom of screen
      const topPosition = buttonRect.bottom + 8;
      const wouldOverflowBottom = topPosition + dropdownHeight > viewportHeight;
      
      // Position above button if it would overflow bottom
      const newTop = wouldOverflowBottom ? buttonRect.top - dropdownHeight - 8 : topPosition;
      
      // Calculate left position to align right edge with button right edge
      let leftPosition = buttonRect.right - dropdownWidth;
      
      // Check if dropdown would go off left edge of screen
      if (leftPosition < 0) {
        leftPosition = 0;
      }
      
      // Check if dropdown would go off right edge of screen
      if (leftPosition + dropdownWidth > viewportWidth) {
        leftPosition = viewportWidth - dropdownWidth;
      }
      
      setDropdownPosition({
        top: newTop,
        left: leftPosition
      });
    }
  }, [isDropdownOpen]);
  
  useEffect(() => {
    updateDropdownPosition();
    
    // Add resize and scroll event listeners
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true); // true for capture phase to catch all scroll events
    
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isDropdownOpen, updateDropdownPosition]);

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
      console.log('Profile API response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Profile data received:', data);
        // API returns { user: {...} } so we need to extract the user object
        if (data.user) {
          setUserProfile({
            username: data.user.username,
            avatar: data.user.avatar
          });
        } else {
          console.error('User data not found in response');
        }
      } else if (response.status === 404) {
        // User doesn't have a profile yet, set default values
        console.log('User profile not found, using default values');
        setUserProfile({
          username: null,
          avatar: null
        });
      } else {
        console.error('Failed to fetch profile:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }, []);

  useEffect(() => {
    const authenticate = async () => {
      if (connected && publicKey) {
        try {
          console.log('Wallet connected, attempting to sign in');
          await signIn();
          console.log('Sign in successful, fetching profile');
          // Wait a bit for the session to be established
          setTimeout(fetchUserProfile, 1000);
        } catch (error) {
          console.error('Authentication error:', error);
        }
      }
    };
    authenticate();
  }, [connected, publicKey, signIn, fetchUserProfile]);
  
  // Add an additional effect to fetch profile when component mounts if already connected
  useEffect(() => {
    if (connected && publicKey) {
      console.log('Component mounted with connected wallet, fetching profile');
      fetchUserProfile();
    }
  }, [connected, publicKey, fetchUserProfile]);
  
  // Force a refresh of the avatar image by updating the timestamp
  const refreshAvatar = useCallback(() => {
    if (connected && publicKey) {
      console.log('Forcing avatar refresh');
      setLastRefreshTime(Date.now());
      fetchUserProfile();
    }
  }, [connected, publicKey, fetchUserProfile]);
  
  // Add a polling mechanism to check for profile updates every 15 seconds
  useEffect(() => {
    if (!connected || !publicKey) return;
    
    // Initial refresh
    refreshAvatar();
    
    // Set up polling
    const intervalId = setInterval(() => {
      refreshAvatar();
    }, 15000); // Check every 15 seconds
    
    // Listen for focus events to refresh when tab becomes active
    const handleFocus = () => refreshAvatar();
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [connected, publicKey, refreshAvatar]);

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
    <div className="relative z-40" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-4 py-2 font-semibold text-sm bg-white text-midnight dark:bg-[hsl(222.2,84%,4.9%)] dark:text-[#ffffff] rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-[hsl(222.2,84%,4.9%)]/90 focus:outline-none focus:ring-2 focus:ring-midnight dark:focus:ring-[#ffffff] focus:ring-opacity-50 transition-colors border border-midnight dark:border-[#ffffff]"
      >
        {userProfile?.avatar ? (
          <Image
            src={`${userProfile.avatar}?t=${lastRefreshTime}`}
            alt="Profile"
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-midnight dark:bg-[#ffffff] rounded-full" />
        )}
        <span>
          {userProfile?.username 
            ? `${userProfile.username.substring(0, 5)}...` 
            : truncateAddress(publicKey?.toString())}
        </span>
      </button>

      {isDropdownOpen && (
        <div className="fixed w-48 rounded-md shadow-lg bg-[#ffffff] dark:bg-[hsl(222.2,84%,4.9%)] border border-midnight dark:border-[#ffffff] focus:outline-none z-50 transition-all duration-150 ease-in-out" style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
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
