import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import RatingForm from '@/components/ratings/RatingForm';

interface Props {
  params: { transactionId: string };
}

export const metadata: Metadata = {
  title: 'Leave a Review - Silkyway',
  description: 'Leave a review for your transaction on Silkyway',
};

export default async function RatingPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user?.id) redirect('/');

  const transaction = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          images: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      offer: {
        select: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      review: true,
    },
  });

  if (!transaction) notFound();

  // Check if user is part of the transaction
  const isBuyer = transaction.offer.sender.id === session.user.id;
  const isSeller = transaction.listing.user.id === session.user.id;
  if (!isBuyer && !isSeller) notFound();

  // Check if a review already exists
  if (transaction.review) {
    redirect('/dashboard');
  }

  // Transform the data to match the expected format
  const transformedTransaction = {
    ...transaction,
    listing: {
      ...transaction.listing,
      mainImage: transaction.listing.images[0], // Use first image as main image
      seller: transaction.listing.user, // Rename user to seller for compatibility
    },
    buyer: transaction.offer.sender, // Add buyer from offer sender
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <RatingForm
        transaction={transformedTransaction}
        type={isBuyer ? 'buyer' : 'seller'}
      />
    </main>
  );
}
