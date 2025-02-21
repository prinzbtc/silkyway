'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { User } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface UserDetails extends User {
  _count: {
    listings: number;
    reviews: number;
    receivedReviews: number;
    favorites: number;
    sentMessages: number;
    receivedMessages: number;
  };
}

export default function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { isAdmin } = useAdminAuth();
  const router = useRouter();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState({
    username: '',
    bio: '',
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch user');
        const data = await response.json();
        setUser(data);
        setEditedUser({
          username: data.username || '',
          bio: data.bio || '',
        });
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) {
      fetchUser();
    }
  }, [isAdmin, params.id]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedUser),
      });

      if (!response.ok) throw new Error('Failed to update user');

      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete user');

      router.push('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  if (!isAdmin || !user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          User Profile: {user.username || 'Anonymous'}
        </h1>
        <div className="space-x-4">
          {isEditing ? (
            <>
              <Button onClick={() => setIsEditing(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsEditing(true)} variant="outline">
                Edit Profile
              </Button>
              <Button onClick={handleDelete} variant="destructive">
                Delete User
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <Input
                    value={editedUser.username}
                    onChange={(e) =>
                      setEditedUser({ ...editedUser, username: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <Textarea
                    value={editedUser.bio}
                    onChange={(e) =>
                      setEditedUser({ ...editedUser, bio: e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p>
                  <span className="font-medium">Wallet Address:</span>{' '}
                  {user.walletAddress}
                </p>
                <p>
                  <span className="font-medium">Username:</span>{' '}
                  {user.username || 'Not set'}
                </p>
                <p>
                  <span className="font-medium">Bio:</span>{' '}
                  {user.bio || 'No bio provided'}
                </p>
                <p>
                  <span className="font-medium">Joined:</span>{' '}
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Activity Statistics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Listings</p>
                <p className="text-2xl font-semibold">{user._count.listings}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reviews Given</p>
                <p className="text-2xl font-semibold">{user._count.reviews}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Reviews Received</p>
                <p className="text-2xl font-semibold">
                  {user._count.receivedReviews}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Messages</p>
                <p className="text-2xl font-semibold">
                  {user._count.sentMessages + user._count.receivedMessages}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            {/* Add recent activity component here */}
          </div>
        </div>
      </div>
    </div>
  );
}
