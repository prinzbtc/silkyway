'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { AdmUserProfileCard } from '@/components/admin/AdmUserProfileCard';
import { User } from '@prisma/client';

export default function UserControlPage() {
  const { isAdmin } = useAdminAuth();
  const [users, setUsers] = useState<(User & {
    _count: {
      listings: number;
      reviews: number;
      receivedReviews: number;
    };
  })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

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
        <h1 className="text-3xl font-bold text-gray-900">User Control</h1>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search users..."
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="listings">Most Listings</option>
            <option value="reviews">Most Reviews</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6">
        {users.map((user) => (
          <AdmUserProfileCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
