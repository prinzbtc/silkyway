'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { SessionData } from '@/app/api/auth/session/route';

interface SessionContextType {
  session: SessionData | null;
  isLoading: boolean;
  error: Error | null;
}

const SessionContext = createContext<SessionContextType>({
  session: null,
  isLoading: true,
  error: null,
});

export function useSessionContext() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) {
          throw new Error('Failed to load session');
        }
        const data = await response.json();
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, []);

  return (
    <SessionContext.Provider value={{ session, isLoading, error }}>
      {children}
    </SessionContext.Provider>
  );
}
