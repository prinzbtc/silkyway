import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { ListingWithFavorite } from '@/types/listing';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import BuyPageContent from '@/components/buy/BuyPageContent';



interface BuyPageProps {
  params: {
    listingId: string;
  };
  searchParams: {
    offerId?: string;
  };
}

export async function generateMetadata({
  params,
}: BuyPageProps): Promise<Metadata> {
  const listing = await prisma.listing.findUnique({
    where: { id: params.listingId },
    select: { title: true },
  });

  return {
    title: `Buy ${listing?.title || 'Listing'} - Silkyway`,
  };
}

export default async function BuyPage({
  params,
  searchParams,
}: BuyPageProps) {
  const session = await getSession();
  if (!session?.user?.id) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h1 className="mb-8 text-3xl font-bold">Buy Item</h1>
          <ConnectWallet />
        </div>
      </main>
    );
  }

  // Get listing with seller info, favorites count, and user's favorite status
  const listing = await prisma.listing.findUnique({
    where: {
      id: params.listingId,
      status: { in: ['active', 'sold', 'deleted'] as const }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
      favorites: {
        where: {
          userId: session.user.id
        },
      },
      _count: {
        select: {
          favorites: true
        }
      }
    },
  });

  if (!listing) {
    redirect('/404');
  }

  // Transform to ListingWithFavorite type
  const { favorites, _count, status, ...rest } = listing;
  const listingWithFavorite: ListingWithFavorite = {
    ...rest,
    status: status as 'active' | 'sold' | 'deleted',
    isFavorite: favorites.length > 0,
    favoritesCount: _count.favorites,
    user: listing.user
  };



  // Check if there's a specific offer price
  let offerPrice = null;
  if (searchParams.offerId) {
    const offer = await prisma.offer.findUnique({
      where: {
        id: searchParams.offerId,
        status: 'accepted',
      },
    });
    if (offer) {
      offerPrice = offer.amount;
    }
  }

  // Calculate fees
  const protectionFee = listingWithFavorite.price * 0.018; // 1.8% protection fee
  const shippingFee = listingWithFavorite.shippingRequired ? 0.01 : 0; // Example: 0.01 SOL shipping fee if required

  return (
    <main className="container mx-auto px-4 py-8">
      <BuyPageContent
        listing={listingWithFavorite}
        offerPrice={offerPrice}
        protectionFee={protectionFee}
        shippingFee={shippingFee}
      />
    </main>
  );
}
