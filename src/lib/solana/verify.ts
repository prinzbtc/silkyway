import { PublicKey } from '@solana/web3.js';
import { sign } from 'tweetnacl';
import { decode as decodeBase64 } from './base64';

export async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    const messageBytes = decodeBase64(message);
    const signatureBytes = decodeBase64(signature);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();

    return sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
