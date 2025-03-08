'use client';

import { FC, useState, useEffect } from 'react';
import Link from 'next/link';

import { Copy, MessageSquare, History, PenSquare, Plus, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { UserBadge } from '@/components/badges/UserBadge';
import { getUserBadges } from '@/lib/badges';
import type { User } from '@/types/user';
import { useBadges } from '@/providers/BadgeProvider';

interface DashboardProfileProps {
  userId: string;
}

export const DashboardProfile: FC<DashboardProfileProps> = ({ userId }) => {
  const { toast } = useToast();
  const { showBadgeNotification } = useBadges();
  const [user, setUser] = useState<User | null>(null);
  const [previousBadges, setPreviousBadges] = useState<string[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const { user: userData } = await response.json();
        setUser(userData);
      }
    };

    fetchUser();
  }, []);

  // Check for newly earned badges
  useEffect(() => {
    if (user) {
      const currentBadges = getUserBadges(user);
      
      // Only update if badges have actually changed
      const newBadges = currentBadges.filter(
        badge => !previousBadges.includes(badge)
      );
      
      // Show notifications for new badges
      newBadges.forEach(badge => {
        showBadgeNotification(badge);
      });
      
      // Only update previousBadges if there are new badges
      if (newBadges.length > 0) {
        setPreviousBadges(currentBadges);
      }
    }
  }, [user, previousBadges, showBadgeNotification]);

  const username = user?.username || 'Anon';

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const copyAddress = async () => {
    if (user?.walletAddress) {
      await navigator.clipboard.writeText(user.walletAddress);
      toast({
        title: 'Address copied',
        description: 'The address has been copied to your clipboard.',
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md dark:shadow-[0_4px_12px_0px_rgba(0,0,0,0.5)] p-6">
      <div className="flex items-start justify-between">
        {/* Profile Info */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={username}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-gray-600">
                  {username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {user && (
              <div className="absolute -right-3 -top-1 flex flex-col gap-0.5">
                {getUserBadges(user).map((badge) => (
                  <UserBadge
                    key={badge}
                    type={badge}
                    className="shadow-sm"
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <Link 
              href="/profile" 
              className="text-lg font-semibold text-gray-900 hover:text-primary"
            >
              {username}
            </Link>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm text-gray-500">
                {user?.walletAddress ? truncateAddress(user.walletAddress) : ''}
              </span>
              <button
                onClick={copyAddress}
                className="text-gray-400 hover:text-gray-600"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/create">
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile/edit">
              <PenSquare className="h-4 w-4 mr-2" />
              Edit Profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/history">
              <History className="h-4 w-4 mr-2" />
              History
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/inbox">
              <MessageSquare className="h-4 w-4 mr-2" />
              Inbox
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
