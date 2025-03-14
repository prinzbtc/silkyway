import { NextApiRequest } from 'next';
import { getSession as getSessionOriginal } from './session';
import type { SessionData } from '@/app/api/auth/session/route';
import { cookies } from 'next/headers';

/**
 * Helper function to get session from NextApiRequest
 * This adapts the NextApiRequest to work with our custom authentication system
 */
export async function getSessionFromApiRequest(req: NextApiRequest): Promise<SessionData | null> {
  // Extract session cookie from NextApiRequest
  const sessionCookie = req.cookies.session;
  if (!sessionCookie) return null;
  
  try {
    // Verify the structure of the cookie before attempting to parse
    const parts = sessionCookie.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT token format');
      return null;
    }

    // Parse the session cookie - handle potential decoding errors
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Return properly formatted SessionData with required exp property
      if (payload?.user && payload.user.id && payload.user.walletAddress) {
        return {
          user: payload.user,
          exp: payload.exp || Math.floor(Date.now() / 1000) + 60 * 60 // Default to 1 hour from now if not present
        };
      } else {
        console.error('Invalid payload structure:', payload);
      }
    } catch (parseError) {
      console.error('Error parsing JWT payload:', parseError);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing session:', error);
    return null;
  }
}

/**
 * Helper function to get session from App Router's Request object
 * This adapts the standard web Request to work with our custom authentication system
 */
export async function getSessionFromAppRequest(request: Request): Promise<SessionData | null> {
  try {
    // For App Router, we need to extract the cookie header from the request
    let sessionCookie: string | undefined;
    
    // Try to get the cookie from the request headers
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';');
      const sessionCookieStr = cookies.find(c => c.trim().startsWith('session='));
      if (sessionCookieStr) {
        sessionCookie = sessionCookieStr.trim().substring('session='.length);
      }
    }
    
    if (!sessionCookie) return null;
    
    // Verify the structure of the cookie before attempting to parse
    const parts = sessionCookie.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT token format');
      return null;
    }

    // Parse the session cookie - handle potential decoding errors
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Return properly formatted SessionData with required exp property
      if (payload?.user && payload.user.id && payload.user.walletAddress) {
        return {
          user: payload.user,
          exp: payload.exp || Math.floor(Date.now() / 1000) + 60 * 60 // Default to 1 hour from now if not present
        };
      } else {
        console.error('Invalid payload structure:', payload);
      }
    } catch (parseError) {
      console.error('Error parsing JWT payload:', parseError);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing session:', error);
    return null;
  }
}
