import ListingClient from './ListingClient';
import type { ListingType } from './ListingClient';
import { Metadata } from 'next';
import { getSession } from '@/lib/auth/session';

type Props = {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {
  return {
    title: `Listing Details`,
  }
}

export default async function ListingPage({ params }: Props) {
  // Get base URL from environment variable or construct from headers
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // Get session
  const session = await getSession();

  // Fetch initial data on the server
  try {
    const res = await fetch(new URL(`/api/listings/${id}/with-favorite`, baseUrl), {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch listing');
    }

    const initialListing: ListingType = await res.json();
    return <ListingClient initialListing={initialListing} listingId={id} session={session} />;
  } catch (error) {
    console.error('Error fetching listing:', error);
    return <ListingClient initialListing={null} listingId={id} session={session} />;
  }
}
