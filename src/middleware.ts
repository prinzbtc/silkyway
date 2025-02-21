import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from './lib/auth/session';

export async function middleware(request: NextRequest) {
  // Paths that require authentication
  const protectedPaths = [
    '/dashboard',
    '/profile',
    '/transactions',
    '/favorites',
    '/inbox',
    '/buy',
    '/sell',
    '/create',
    '/settings'
  ];

  // Paths that should redirect to home if authenticated
  const authPaths = ['/login', '/signup'];

  const path = request.nextUrl.pathname;
  const session = await getSession(request);

  // Check if the current path requires authentication
  const isProtectedPath = protectedPaths.some(p => path.startsWith(p));
  const isAuthPath = authPaths.some(p => path.startsWith(p));

  // Handle protected routes
  if (isProtectedPath) {
    if (!session) {
      console.log('No session found for protected route, redirecting to login');
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Handle authentication paths
  if (isAuthPath) {
    if (session) {
      console.log('Session exists for auth path, redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Add user context to request headers for server-side use
  const requestHeaders = new Headers(request.headers);
  
  if (session?.user) {
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-wallet-address', session.user.walletAddress);
  }

  // Special handling for API routes
  if (path.startsWith('/api/')) {
    // Validate session for most API routes, with exceptions
    const publicApiRoutes = [
      '/api/auth/verify',
      '/api/auth/session',
      '/api/listings', // Public listings
      '/api/search'    // Public search
    ];

    const isPublicApiRoute = publicApiRoutes.some(p => path.startsWith(p));

    if (!isPublicApiRoute && !session) {
      console.log('Unauthorized API access attempt');
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }), 
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  // Return modified request headers
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ]
};
