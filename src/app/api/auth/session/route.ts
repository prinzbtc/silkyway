import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import type { JWTPayload } from 'jose';
import type { RequestCookies } from 'next/dist/server/web/spec-extension/cookies';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default_jwt_secret_replace_in_production'
);

export interface SessionData {
  user: {
    id: string;
    walletAddress: string;
    isAdmin?: boolean;
    name?: string | null;
    username?: string | null;
    image?: string | null;
    avatar?: string | null;
  };
  exp: number;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie?.value) {
    return NextResponse.json(null);
  }

  try {
    const { payload } = await jwtVerify(sessionCookie.value, JWT_SECRET);
    const { exp, user } = payload as JWTPayload & { user: SessionData['user'] };
    return NextResponse.json({ exp: exp!, user });
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  console.log('Creating new session');
  const { userId, walletAddress } = await request.json();
  console.log('Session data:', { userId, walletAddress });
  const sessionId = nanoid();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week

  const session = await new SignJWT({
    user: {
      id: userId,
      walletAddress
    }
  } as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expires.getTime() / 1000)
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieValue = `session=${session}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
  console.log('Setting cookie:', {
    sessionLength: session.length,
    cookieLength: cookieValue.length,
    expires: expires.toUTCString()
  });

  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': cookieValue
      }
    }
  );
  console.log('Session cookie set');
  return response;
}

export async function DELETE() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': `session=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    }
  );
}
