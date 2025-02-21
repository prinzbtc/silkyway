import prisma from '@/lib/prisma';

export async function getUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        walletAddress: true,
        completedTransactionCount: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            listings: true,
            receivedReviews: true
          }
        }
      }
    });

    // Calculate average rating
    const userReviews = await prisma.review.findMany({
      where: { receiverId: userId }
    });
    const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = userReviews.length > 0 
      ? Math.round((totalRating / userReviews.length) * 10) / 10 
      : 0;

    return user ? { 
      ...user, 
      totalRating: totalRating,
      averageRating: averageRating 
    } : null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}
