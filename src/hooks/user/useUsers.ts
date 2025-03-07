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

  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct query parameters
      const params = new URLSearchParams();
      
      // Add search query if present
      if (filters.q) params.append('q', filters.q);
      
      // Add region filter if present
      if (filters.region) params.append('region', filters.region);
      
      // Add seller location filter if present
      if (filters.sellerLocation) {
        params.append('sellerLocation', JSON.stringify(filters.sellerLocation));
      }

      // Add pagination parameters
      params.append('page', page.toString());
      params.append('limit', '20');

      // Fetch users
      const response = await fetch(`/api/users?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();

      // Update users and pagination state
      setUsers(data.users);
      setPagination({
        currentPage: page,
        totalPages: data.pagination.totalPages,
        totalUsers: data.pagination.totalUsers
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  return {
    users,
    pagination,
    isLoading,
    error,
    fetchUsers
  };
};
