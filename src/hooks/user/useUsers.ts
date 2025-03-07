import { useState, useEffect, useCallback } from 'react';
import { useSearch } from '@/context/SearchProvider';
import { CountrySelectValue } from '@/types/country';

// Define the user type based on the API response
export interface User {
  id: string;
  username: string | null;
  avatar: string | null;
  location: string | null;
}

export interface UserSearchPagination {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
}

export const useUsers = () => {
  const { filters } = useSearch();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<UserSearchPagination>({
    currentPage: 1,
    totalPages: 0,
    totalUsers: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Log when the hook is initialized or filters change
  useEffect(() => {
    console.log('useUsers hook - current filters:', {
      searchMode: filters.searchMode,
      q: filters.q,
      region: filters.region,
      sellerLocation: filters.sellerLocation
    });
  }, [filters]);

  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct query parameters
      const params = new URLSearchParams();
      
      // Add search query if present
      if (filters.q) params.append('q', filters.q);
      
      // Region and sellerLocation filters have been removed

      // Add pagination parameters
      params.append('page', page.toString());
      params.append('limit', '20');

      console.log('Fetching users with params:', params.toString());

      // Fetch users
      const response = await fetch(`/api/users?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Received user data:', data);

      // Update users and pagination state
      setUsers(data.users);
      setPagination({
        currentPage: page,
        totalPages: data.pagination.totalPages,
        totalUsers: data.pagination.totalUsers
      });
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters.q]);

  // Initial fetch when the hook is first mounted and search mode is 'users'
  useEffect(() => {
    if (filters.searchMode === 'users') {
      console.log('Initial user fetch on hook mount with search mode = users');
      fetchUsers(1);
    }
  }, [fetchUsers, filters.searchMode]);

  return {
    users,
    pagination,
    isLoading,
    error,
    fetchUsers
  };
};
