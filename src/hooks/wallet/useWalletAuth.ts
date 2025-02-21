import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useState } from 'react';
import { encode as encodeBase64 } from '@/lib/solana/base64';

export const useWalletAuth = () => {
  const { publicKey, signMessage, disconnect } = useWallet();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected!');
    }

    try {
      setIsAuthenticating(true);

      // Create a random nonce
      const nonce = crypto.getRandomValues(new Uint8Array(32));
      const message = new TextEncoder().encode(
        `Sign in to Silkyway\nNonce: ${encodeBase64(nonce)}`
      );

      // Sign the message
      const signature = await signMessage(message);

      // Send to backend for verification
      // Verify signature and create session
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          message: encodeBase64(message),
          signature: encodeBase64(signature),
        }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      await disconnect();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, [disconnect]);

  return {
    isAuthenticating,
    signIn,
    signOut,
  };
};
