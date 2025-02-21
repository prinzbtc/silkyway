import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { DashboardProfile } from './DashboardProfile';
import { ActiveListings } from './ActiveListings';
import { LatestTransactions } from './LatestTransactions';
import FavoriteListings from './FavoriteListings';
import { TransactionSummary } from './TransactionSummary';

export default async function DashboardPage() {
  console.log('Dashboard page - session retrieval started');
  
  // Server-side session check
  const session = await getSession();

  console.log('Dashboard page - session retrieved:', {
    sessionExists: !!session,
    userId: session?.user?.id,
    walletAddress: session?.user?.walletAddress,
    nodeEnv: process.env.NODE_ENV
  });

  if (!session?.user?.id) {
    console.log('Dashboard page - no session, redirecting to home');
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Section */}
        <div className="mb-8">
          <DashboardProfile userId={session.user.id} />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Listings */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Active Listings
              </h2>
              <ActiveListings userId={session.user.id} />
            </section>

            {/* Latest Transactions */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Latest Transactions
              </h2>
              <LatestTransactions userId={session.user.id} />
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Transaction Summary */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Transaction Summary
              </h2>
              <TransactionSummary userId={session.user.id} />
            </section>

            {/* Favorites */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Favorites
              </h2>
              <FavoriteListings />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
