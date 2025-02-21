'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

interface AdminAuthContextType {
  isAdmin: boolean;
  isLoading: boolean;
  user: {
    id: string;
    walletAddress: string;
    adminRole?: string;
  } | null;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  isAdmin: false,
  isLoading: true,
  user: null,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, signMessage } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AdminAuthContextType['user']>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!publicKey) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      try {
        // Get challenge from server
        const challengeResponse = await fetch('/api/admin/auth/challenge');
        const { challenge } = await challengeResponse.json();

        // Sign the challenge
        const message = new TextEncoder().encode(challenge);
        const signature = await signMessage!(message);

        // Verify admin status
        const verifyResponse = await fetch('/api/admin/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicKey: publicKey.toBase58(),
            signature: Array.from(signature),
            challenge,
          }),
        });

        const { isAdmin: isAdminResponse, user: userData } = await verifyResponse.json();
        setIsAdmin(isAdminResponse);
        setUser(userData);

        if (!verifyResponse.ok) {
          setIsAdmin(false);
          setUser(null);
          router.push('/');
        }
      } catch (error) {
        console.error('Admin authentication error:', error);
        setIsAdmin(false);
        router.push('/');
      }

      setIsLoading(false);
    };

    checkAdminStatus();
  }, [publicKey, signMessage, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminAuthContext.Provider value={{ isAdmin, isLoading, user }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
