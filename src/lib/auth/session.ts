import type { SessionData } from '@/app/api/auth/session/route';
import { jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default_jwt_secret_replace_in_production'
);

async function getSession(req?: Request): Promise<SessionData | null> {
  // Consistent logging with reduced verbosity
  const logContext = {
    nodeEnv: process.env.NODE_ENV,
    isServer: typeof window === 'undefined',
    requestProvided: !!req
  };
  console.log('Getting session', logContext);

  // Server-side session retrieval
  if (typeof window === 'undefined') {
    try {
      let sessionCookie: string | undefined;
      
      // Prioritize request headers
      if (req?.headers) {
        const cookieHeader = req.headers.get('cookie') || '';
        sessionCookie = cookieHeader
          .split(';')
          .find(cookie => cookie.trim().startsWith('session='))
          ?.split('=')[1]
          ?.trim();
      }
      
      // Fallback to server-side cookies in development
      if (!sessionCookie && process.env.NODE_ENV === 'development') {
        const cookiesModule = await import('next/headers');
        const cookieStore = await cookiesModule.cookies();
        sessionCookie = cookieStore.get('session')?.value;
      }

      // If no session cookie found, return null
      if (!sessionCookie) {
        console.log('No session cookie found');
        return null;
      }

      // Verify JWT
      const { payload } = await jwtVerify(
        sessionCookie, 
        JWT_SECRET,
        { 
          algorithms: ['HS256'],
          maxTokenAge: '7d' // Ensure token is not too old
        }
      );
      
      // Ensure payload has expected structure
      const sessionPayload = payload as JWTPayload & { 
        user?: { 
          id: string; 
          walletAddress: string 
        } 
      };

      if (!sessionPayload.user?.id || !sessionPayload.user?.walletAddress) {
        console.log('Invalid session payload');
        return null;
      }

      return { 
        exp: sessionPayload.exp!, 
        user: { 
          id: sessionPayload.user.id, 
          walletAddress: sessionPayload.user.walletAddress 
        } 
      } as SessionData;
    } catch (error) {
      console.error('Session retrieval error:', error);
      return null;
    }
  }

  // Client-side session retrieval
  try {
    const response = await fetch('/api/auth/session', { 
      cache: 'no-store',  // Prevent caching
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.log('Session fetch failed');
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error('Client-side session fetch error:', error);
    return null;
  }
}

async function createSession(data: { userId: string; walletAddress: string }, req?: Request) {
  let url: string;
  
  if (typeof window === 'undefined') {
    // Server-side: need absolute URL
    if (!req?.url) {
      throw new Error('Request URL not provided for server-side createSession');
    }
    url = new URL('/api/auth/session', req.url).toString();
  } else {
    // Client-side: relative URL is fine
    url = '/api/auth/session';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.ok;
}

async function deleteSession() {
  await fetch('/api/auth/session', {
    method: 'DELETE',
  });
}

export { getSession, createSession, deleteSession };
