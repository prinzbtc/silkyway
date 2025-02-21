'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmListingCard } from '@/components/admin/AdmListingCard';
import { Listing, User } from '@prisma/client';

type ListingWithUser = Listing & {
  user: User;
  _count: {
    favorites: number;
    offers: number;
    reports: number;
  };
};

export default function ListingControlPage() {
  const { isAdmin } = useAdminAuth();
  const [listings, setListings] = useState<ListingWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, sold, reported
  const [sort, setSort] = useState('newest'); // newest, oldest, price-high, price-low

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const response = await fetch('/api/admin/listings');
        if (!response.ok) throw new Error('Failed to fetch listings');
        const data = await response.json();
        setListings(data);
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchListings();
    }
  }, [isAdmin]);

  const filteredListings = listings
    .filter((listing) => {
      // Search filter
      const searchMatch = listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.user.username?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const statusMatch = filter === 'all' ||
        (filter === 'reported' && listing._count.reports > 0) ||
        listing.status === filter;

      return searchMatch && statusMatch;
    })
    .sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'price-high':
          return b.price - a.price;
        case 'price-low':
          return a.price - b.price;
        default: // newest
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  if (!isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Listing Control</h1>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Listings</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="reported">Reported</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {filteredListings.map((listing) => (
          <AdmListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {filteredListings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No listings found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
