import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/lib/solana/verify';
import { authRateLimiter } from '@/lib/rate-limit';
import prisma from '@/lib/prisma';
import { SignJWT } from 'jose';
import { jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

// Define a custom interface for our JWT payload
interface CustomJWTPayload extends JWTPayload {
  user?: {
    id: string;
    walletAddress: string;
  };
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default_jwt_secret_replace_in_production'
);

export async function getSession(request: NextRequest): Promise<CustomJWTPayload | null> {
  const cookie = request.cookies.get('session');
  if (!cookie) return null;

  try {
    // Use jose to verify the JWT
    const { payload } = await jwtVerify(
      cookie.value, 
      JWT_SECRET, 
      { 
        algorithms: ['HS256'],
        // Add additional validation checks
        clockTolerance: 30, // 30 seconds clock skew
        maxTokenAge: '7d' // Maximum token age of 7 days
      }
    );

    // Type assertion and additional checks
    const customPayload = payload as CustomJWTPayload;

    // Additional checks
    if (!customPayload.user?.walletAddress || !customPayload.user?.id) {
      return null;
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { 
        id: customPayload.user.id,
        walletAddress: customPayload.user.walletAddress 
      },
      select: {
        id: true,
        walletAddress: true
      }
    });

    return user ? customPayload : null;
  } catch (error) {
    console.log('Session validation error:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // More robust session check
    const existingSession = await getSession(request);
    if (existingSession?.user?.walletAddress) {
      console.log('Existing valid session found, skipping re-authentication');
      return NextResponse.json({
        user: {
          id: existingSession.user.id,
          walletAddress: existingSession.user.walletAddress,
        },
        sessionRenewed: false // Indicate no new session was created
      });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1';
    const { success } = await authRateLimiter.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { publicKey, message, signature } = body;

    if (!publicKey || !message || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the signature
    const isValid = await verifySignature(message, signature, publicKey);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: publicKey },
      select: {
        id: true,
        username: true,
        avatar: true,
        walletAddress: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: publicKey,
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          walletAddress: true,
        },
      });
    }

    console.log('Creating session for user:', { userId: user.id, walletAddress: user.walletAddress });
    // Create session token
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
    const session = await new SignJWT({
      user: {
        id: user.id,
        walletAddress: user.walletAddress
      }
    } as CustomJWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expires.getTime() / 1000)
      .setIssuedAt()
      .sign(JWT_SECRET);

    const cookieValue = `session=${session}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}`;
    console.log('Setting cookie directly in verify endpoint');

    // Set cookie in the response headers
    return NextResponse.json(
      {
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          walletAddress: user.walletAddress,
        },
        sessionRenewed: true // Indicate a new session was created
      },
      {
        headers: {
          'Set-Cookie': cookieValue
        }
      }
    );
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
