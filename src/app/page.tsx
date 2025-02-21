import { Suspense } from 'react';
import Link from 'next/link';
import { AnimatedButton } from '@/components/ui/animated-button';
import { ArrowRight } from 'lucide-react';
import { ListingGridSkeleton } from '@/components/listings/ListingGridSkeleton';
import { FeaturedListings, LatestListings, RecommendedListings } from '@/components/listings/sections';


export default function Home() {
  // We'll fetch listings client-side to ensure they're always fresh
  // and to properly handle user-specific recommendations

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
        <section className="bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="text-center">

              <div className="mt-8 flex justify-center">
                <AnimatedButton asChild size="lg">
                  <Link href="/explore">
                    Explore Listings
                    <ArrowRight className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
                  </Link>
                </AnimatedButton>
              </div>
            </div>
          </div>
        </section>

        {/* For You Section */}
        <section className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">For You</h2>
              <Link
                href="/explore?filter=recommended"
                className="text-primary hover:text-primary/90 transition-colors"
              >
                View all
              </Link>
            </div>
            <Suspense fallback={<ListingGridSkeleton count={8} />}>
              <RecommendedListings />
            </Suspense>
          </div>
        </section>

        {/* Featured Listings */}
        <section className="py-12 sm:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Featured Listings</h2>
              <Link
                href="/explore?filter=featured"
                className="text-primary hover:text-primary/90 transition-colors"
              >
                View all
              </Link>
            </div>
            <Suspense fallback={<ListingGridSkeleton count={8} />}>
              <FeaturedListings />
            </Suspense>
          </div>
        </section>

        {/* Latest Listings */}
        <section className="py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Latest Listings</h2>
              <Link
                href="/explore?filter=latest"
                className="text-primary hover:text-primary/90 transition-colors"
              >
                View all
              </Link>
            </div>
            <Suspense fallback={<ListingGridSkeleton count={8} />}>
              <LatestListings />
            </Suspense>
          </div>
        </section>
    </div>
  );
}
