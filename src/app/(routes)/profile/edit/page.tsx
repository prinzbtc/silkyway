import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { User } from '@/types/user';

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  if (!session?.user?.id) {
    return {
      title: 'Anon - Silkyway',
      description: 'Edit your Silkyway profile',
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true }
  });

  return {
    title: dbUser?.username ? `${dbUser.username} - Silkyway` : 'Anon - Silkyway',
    description: 'Edit your Silkyway profile',
  };
};

export default async function EditProfilePage({ params }: { params: { userId?: string } }) {
  const session = await getSession();
  if (!session?.user?.id) redirect('/');

  // If a specific user profile is requested, check if current user has permission
  if (params?.userId && params.userId !== session.user.id) {
    redirect('/profile');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      avatar: true,
      walletAddress: true,
      bio: true,
      location: true,
      email: true,
      adminRole: true,
      notificationPreferences: true,
      twitterHandle: true,
      twitterVerifiedAt: true,
      completedTransactionCount: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      deletedAt: true
    }
  });
  
  if (!dbUser) redirect('/');

  // Parse notification preferences with defaults
  const notificationPrefs = dbUser.notificationPreferences as { 
    hideWalletAddress?: boolean;
    allowInAppNotifications?: boolean;
    allowEmailNotifications?: boolean;
    allowUpdates?: boolean;
  } || {};

  const user: User = {
    ...dbUser,
    hideWalletAddress: notificationPrefs.hideWalletAddress ?? false,
    allowInAppNotifications: notificationPrefs.allowInAppNotifications ?? true,
    allowEmailNotifications: notificationPrefs.allowEmailNotifications ?? true,
    allowUpdates: notificationPrefs.allowUpdates ?? true,
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">
        {user.username || 'Anon'} - Edit your Profile
      </h1>
      <EditProfileForm user={user} />
    </main>
  );
}
