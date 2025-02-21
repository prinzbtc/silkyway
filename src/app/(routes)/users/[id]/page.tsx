import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ProfileCard from '@/components/profile/ProfileCard';
import RatingCard from '@/components/profile/RatingCard';

interface Props {
  params: { id: string };
}

async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          listings: true,
          receivedReviews: true,
        },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await getUser(params.id);
  if (!user) return { title: 'User Not Found - Silkyway' };
  
  return {
    title: `${user.username || 'Anon'} - Silkyway`,
    description: user.bio || `View ${user.username || 'Anon'}'s profile on Silkyway`,
  };
}

export default async function UserProfilePage({ params }: Props) {
  const user = await getUser(params.id);
  if (!user) notFound();

  const session = await getSession();
  const isOwner = session?.user?.id === user.id;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <ProfileCard user={user} isOwner={isOwner} />
        </div>
        <div>
          <RatingCard userId={user.id} />
        </div>
      </div>
    </main>
  );
}
