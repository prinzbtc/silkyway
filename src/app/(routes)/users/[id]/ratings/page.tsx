import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import RatingList from '@/components/ratings/RatingList';
import Link from 'next/link';

interface Props {
  params: { id: string };
}

async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          receivedReviews: true,
          reviews: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUser(params.id);
  if (!user) return { title: 'User Not Found - Silkyway' };
  
  return {
    title: `${user.username || 'Anon'}'s Ratings - Silkyway`,
    description: `View ratings and reviews for ${user.username || 'Anon'} on Silkyway`,
  };
}

export default async function UserRatingsPage({ params }: Props) {
  const user = await getUser(params.id);
  if (!user) notFound();

  const session = await getSession();
  const isOwner = session?.user?.id === user.id;

  return (
    <main className="container mx-auto px-4 py-8">
      {isOwner ? (
        <>
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">What people say about you</h2>
            <RatingList userId={user.id} type="received" />
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">What you said about other folks</h2>
            <RatingList userId={user.id} type="given" />
          </section>

          <Button asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-bold">
              What people say about {user.username || 'Anon'}
            </h2>
            <RatingList userId={user.id} type="received" />
          </section>

          {session?.user ? (
            <Button asChild>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          ) : (
            <Button onClick={() => window.history.back()}>
              Back to Previous Page
            </Button>
          )}
        </>
      )}
    </main>
  );
}
