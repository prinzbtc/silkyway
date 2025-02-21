import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard';
import TransactionList from '@/components/transactions/TransactionList';
import { Transaction, TransactionStatus } from '@/types/transaction';

export const metadata: Metadata = {
  title: 'Transaction History - Silkyway',
  description: 'View your transaction history on Silkyway',
};

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h1 className="mb-8 text-3xl font-bold">Transaction History</h1>
          <ConnectWallet />
        </div>
      </main>
    );
  }

  // Get user's transactions
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { 
          offer: {
            senderId: session.user.id
          }
        },
        { 
          listing: { 
            userId: session.user.id 
          } 
        },
      ],
    },
    include: {
      listing: {
        include: {
          user: true,
        },
      },
      offer: {
        include: {
          sender: true,
          receiver: true,
        },
      },
      review: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Transform transactions to match the Transaction interface
  const transformedTransactions: Transaction[] = transactions.map(transaction => {
    // Ensure listing has correct status type
    const listing = {
      ...transaction.listing,
      mainImage: transaction.listing.images[0],
      status: transaction.listing.status as 'active' | 'sold' | 'deleted',
    };

    // Create complete user objects with required fields
    const createFullUser = (partialUser: any) => ({
      id: partialUser.id,
      username: partialUser.username,
      avatar: partialUser.avatar,
      walletAddress: partialUser.walletAddress,
      bio: partialUser.bio || null,
      location: partialUser.location || null,
      email: partialUser.email || null,
      hideWalletAddress: partialUser.hideWalletAddress ?? false,
      allowInAppNotifications: partialUser.allowInAppNotifications ?? true,
      allowEmailNotifications: partialUser.allowEmailNotifications ?? true,
      allowUpdates: partialUser.allowUpdates ?? true,
      twitterHandle: partialUser.twitterHandle || null,
      twitterVerifiedAt: partialUser.twitterVerifiedAt || null,
      completedTransactionCount: partialUser.completedTransactionCount || 0,
      createdAt: partialUser.createdAt || new Date(),
      updatedAt: partialUser.updatedAt || new Date(),
      lastLoginAt: partialUser.lastLoginAt || null,
      deletedAt: partialUser.deletedAt || null
    });

    const buyer = createFullUser(transaction.offer.sender);
    const seller = createFullUser(transaction.listing.user);

    return {
      id: transaction.id,
      listingId: transaction.listingId,
      listing,
      buyerId: transaction.offer.sender.id,
      buyer,
      sellerId: transaction.listing.userId,
      seller,
      amount: transaction.amount,
      status: transaction.status as TransactionStatus,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
      protectionFee: transaction.protectionFee || 0,
      shippingFee: transaction.shippingFee || 0,
      escrowAddress: transaction.escrowAddress || '',
      signature: transaction.signature || '',
      trackingNumber: transaction.trackingNumber || undefined,
      cancelledAt: undefined, // This field doesn't exist in our schema
      reviewId: transaction.review?.id
    };
  });

  // Calculate totals for summary
  const summary = transformedTransactions.reduce(
    (acc, transaction) => {
      const total = transaction.amount;
      if (transaction.buyerId === session.user.id) {
        acc.totalBuys += total;
      } else {
        acc.totalSales += total;
      }
      return acc;
    },
    { totalBuys: 0, totalSales: 0 }
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Transaction History</h1>
      
      <div className="mb-8">
        <TransactionSummaryCard
          totalBuys={summary.totalBuys}
          totalSales={summary.totalSales}
        />
      </div>

      <TransactionList
        transactions={transformedTransactions}
        userId={session.user.id}
      />
    </main>
  );
}
