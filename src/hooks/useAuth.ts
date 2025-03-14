'use client';

import { useEffect, useState } from 'react';
import { getSession, deleteSession } from '@/lib/auth/session';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthSession {
  user: {
    id: string;
    walletAddress: string;
    name?: string | null;
    image?: string | null;
  };
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    async function loadSession() {
      try {
        const sessionData = await getSession();
        if (sessionData?.user) {
          // Create a session object with all necessary properties
          setSession({
            user: {
              id: sessionData.user.id,
              walletAddress: sessionData.user.walletAddress,
              name: sessionData.user.name || sessionData.user.username || null,
              image: sessionData.user.image || sessionData.user.avatar || null,
              // Include isAdmin if present
              ...(sessionData.user.isAdmin !== undefined && { isAdmin: sessionData.user.isAdmin })
            }
          });
          setStatus('authenticated');
        } else {
          setSession(null);
          setStatus('unauthenticated');
        }
      } catch (error) {
        console.error('Error loading session:', error);
        setSession(null);
        setStatus('unauthenticated');
      }
    }

    loadSession();
  }, []);

  const signOut = async () => {
    try {
      await deleteSession();
      setSession(null);
      setStatus('unauthenticated');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return {
    data: session,
    status,
    signOut
  };
}
