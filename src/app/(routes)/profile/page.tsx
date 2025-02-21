import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import ProfileCard from '@/components/profile/ProfileCard';
import RatingCard from '@/components/profile/RatingCard';

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: {
        select: {
          listings: true,
          receivedReviews: true,
        },
      },
    },
  });

  if (!user) {
    redirect('/');
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <ProfileCard user={user} isOwner={true} />
        </div>
        <div>
          <RatingCard userId={user.id} />
        </div>
      </div>
    </main>
  );
}
