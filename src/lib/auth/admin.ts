import { cookies } from 'next/headers';
import { verifySignature } from '@/lib/solana';
import prisma from '@/lib/prisma';

/**
 * Verifies the admin session from the request headers
 * Uses the same Solana wallet signature verification as the main site
 */
export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (!sessionToken) {
    return null;
  }

  try {
    // Verify the session token signature
    const [walletAddress, signature, message] = sessionToken.split(':');
    const isValid = await verifySignature(signature, message, walletAddress);
    
    if (!isValid) {
      return null;
    }

    // Get the user and verify admin status
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        walletAddress: true,
        adminRole: true,
      },
    });

    if (!user?.adminRole) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error verifying admin session:', error);
    return null;
  }
}
