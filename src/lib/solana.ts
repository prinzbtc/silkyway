import * as ed from '@noble/ed25519';

/**
 * Verifies a Solana wallet signature
 * @param signature - Hex encoded signature
 * @param message - Original message that was signed
 * @param walletAddress - Solana wallet address
 */
export async function verifySignature(
  signature: string,
  message: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const signatureBytes = Buffer.from(signature, 'hex');
    const messageBytes = Buffer.from(message);
    const publicKeyBytes = Buffer.from(walletAddress, 'hex');
    
    return await ed.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Creates a challenge message for wallet signature
 * @param nonce - Random nonce to prevent replay attacks
 */
export function createChallengeMessage(nonce: string): string {
  return `Sign this message to verify your wallet ownership.\nNonce: ${nonce}`;
}
