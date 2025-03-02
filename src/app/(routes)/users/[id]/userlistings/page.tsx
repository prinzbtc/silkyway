import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import UserListingsGrid from '@/components/userlistings/UserListingsGrid';
import { getUserById } from '@/lib/actions/user';
import { Skeleton } from '@/components/ui/skeleton';
import prisma from '@/lib/prisma';

export async function generateStaticParams() {
  const users = await prisma.user.findMany({
    select: { id: true },
    take: 100 // Limit to prevent generating too many static pages
  });

  return users.map((user) => ({
    id: user.id
  }));
}

async function UserListingsContent({ userId }: { userId: string }) {
  const user = await getUserById(userId);

  if (!user) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Listings by {user.username}
      </h1>
      <UserListingsGrid userId={userId} />
    </div>
  );
}

export async function generateMetadata({ 
  params 
}: { 
  params: { id: string } 
}): Promise<Metadata> {
  // Await params to fix the Next.js warning
  const resolvedParams = await params;
  const user = await getUserById(resolvedParams.id);
  
  if (!user) {
    return {
      title: 'User Not Found',
      description: 'The requested user profile could not be found'
    };
  }

  return {
    title: `${user.username}'s Listings`,
    description: `Browse all listings by ${user.username}`
  };
}

export default async function UserListingsPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  // Await params to fix the Next.js warning
  const resolvedParams = await params;
  
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-1/2 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      </div>
    }>
      <UserListingsContent userId={resolvedParams.id} />
    </Suspense>
  );
}
