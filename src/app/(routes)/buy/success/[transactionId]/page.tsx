import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import SuccessBuyContent from '@/components/buy/SuccessBuyContent';

interface SuccessBuyPageProps {
  params: {
    transactionId: string;
  };
}

interface TransactionResponse {
  id: string;
  amount: number;
  status: string;
  escrowAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  listingId: string;
  offerId: string;
  offer: {
    senderId: string;
  };
  listing: {
    id: string;
    title: string;
    images: string[];
    price: number;
    user: {
      id: string;
      username: string | null;
      avatar: string | null;
    };
  };
}

export const metadata: Metadata = {
  title: 'Purchase Successful - Silkyway',
  description: 'Your purchase was successful',
};

export default async function SuccessBuyPage({
  params,
}: SuccessBuyPageProps) {
  const session = await getSession();
  if (!session?.user?.id) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h1 className="mb-8 text-3xl font-bold">Purchase Successful</h1>
          <ConnectWallet />
        </div>
      </main>
    );
  }

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: params.transactionId,
    },
    include: {
      offer: {
        select: {
          senderId: true,
        },
      },
      listing: {
        select: {
          id: true,
          title: true,
          images: true,
          price: true,
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!transaction || transaction.offer.senderId !== session.user.id) {
    redirect('/404');
  }

  // Transform the data to match the expected format
  const transformedTransaction = {
    ...transaction,
    listing: {
      ...transaction.listing,
      mainImage: transaction.listing.images[0], // Use the first image as the main image
    },
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <SuccessBuyContent transaction={transformedTransaction} />
    </main>
  );
}
