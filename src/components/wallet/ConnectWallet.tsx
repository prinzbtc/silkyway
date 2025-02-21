'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent } from '@/components/ui/card';

export default function ConnectWallet() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center p-6">
        <h2 className="mb-4 text-lg font-medium">Connect Your Wallet</h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          You need to connect your wallet to access this page.
          All transactions are secure and protected.
        </p>
        <WalletMultiButton />
      </CardContent>
    </Card>
  );
}
