import { useCallback, useState } from 'react';
import useSWR from 'swr';

export interface LocationData {
  value: string;
  label: string;
  flag: string;
}

interface UserProfile {
  id: string;
  username: string | null;
  avatar: string | null;
  bio: string | null;
  location: string | null;
  walletAddress: string;
  createdAt: string;
  email?: string;
  twitterHandle?: string;
  hideWalletAddress?: boolean;
  allowInAppNotifications?: boolean;
  allowEmailNotifications?: boolean;
  allowUpdates?: boolean;
}

interface UpdateProfileData {
  username?: string;
  avatar?: string | null;
  bio?: string;
  location?: string;
  email?: string;
  twitterHandle?: string;
  hideWalletAddress?: boolean;
  allowInAppNotifications?: boolean;
  allowEmailNotifications?: boolean;
  allowUpdates?: boolean;
}

const fetcher = (url: string) => fetch(url, {
  headers: {
    'x-user-id': typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''
  }
}).then((res) => res.json());

export function useProfile() {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { data, error, mutate } = useSWR<{ user: UserProfile }>(
    '/api/user/profile',
    fetcher
  );

  const updateProfile = useCallback(async (updateData: UpdateProfileData) => {
    try {
      setIsUpdating(true);
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''
        },
        body: JSON.stringify(updateData),
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update profile');
      }

      await mutate(result, false); // Update the local data without revalidating
      return result;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [mutate]);

  return {
    profile: data?.user,
    isLoading: !error && !data,
    isUpdating,
    error,
    updateProfile,
  };
}
