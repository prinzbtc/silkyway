import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { verify } from '@noble/ed25519';
import { challenges } from '../challenge/route';
import bs58 from 'bs58';

// List of admin wallet addresses
const ADMIN_ADDRESSES = [
  '58cPXoxj6f4VnNs8SYirXifURsvqAp8BJdw26UieVuiB',
  // Add more admin addresses here
];

export async function POST(req: Request) {
  try {
    const { publicKey, signature, challenge } = await req.json();

    // Check if challenge exists and is not expired
    const storedChallenge = challenges.get(challenge);
    if (!storedChallenge) {
      return new NextResponse('Invalid or expired challenge', { status: 400 });
    }

    // Check if challenge is not older than 5 minutes
    if (Date.now() - storedChallenge.timestamp > 300000) {
      challenges.delete(challenge);
      return new NextResponse('Challenge expired', { status: 400 });
    }

    // Verify that the wallet is in the admin list
    if (!ADMIN_ADDRESSES.includes(publicKey)) {
      return new NextResponse('Unauthorized', { status: 403 });
    }

    // Verify signature
    const message = new TextEncoder().encode(challenge);
    const signatureUint8 = new Uint8Array(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    const isValid = await verify(signatureUint8, message, publicKeyBytes);
    if (!isValid) {
      return new NextResponse('Invalid signature', { status: 400 });
    }

    // Remove used challenge
    challenges.delete(challenge);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin verification error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
