import prisma from '@/lib/prisma';

export async function updateTransactionCounts() {
  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      _count: {
        select: {
          buyerTransactions: {
            where: {
              status: 'completed'
            }
          },
          sellerTransactions: {
            where: {
              status: 'completed'
            }
          }
        }
      }
    }
  });

  // Update transaction counts in batches
  const batchSize = 100;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(user => 
        prisma.user.update({
          where: { id: user.id },
          data: {
            completedTransactionCount: 
              user._count.buyerTransactions + 
              user._count.sellerTransactions
          }
        })
      )
    );
  }
}

// Helper function to update a single user's transaction count
export async function updateUserTransactionCount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          buyerTransactions: {
            where: {
              status: 'completed'
            }
          },
          sellerTransactions: {
            where: {
              status: 'completed'
            }
          }
        }
      }
    }
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      completedTransactionCount: 
        user._count.buyerTransactions + 
        user._count.sellerTransactions
    }
  });
}
