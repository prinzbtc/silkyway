import { FC } from 'react';
import { useUsers } from '@/hooks/user/useUsers';
import SmallProfileCard from '@/components/user/SmallProfileCard';
import { CountrySelectValue } from '@/types/country';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const UserResults: FC = () => {
  const { 
    users, 
    pagination, 
    isLoading, 
    error, 
    fetchUsers 
  } = useUsers();

  // Helper to parse location string to CountrySelectValue
  const parseLocation = (locationStr: string | null): CountrySelectValue | null => {
    if (!locationStr) return null;
    
    const parts = locationStr.split('|');
    if (parts.length >= 3) {
      return {
        value: parts[0],
        label: parts[1],
        flag: parts[2]
      };
    }
    
    return null;
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center text-destructive p-4">
        <p>Error: {error}</p>
      </div>
    );
  }

  // Render no results state
  if (users.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        <p>No users found matching your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <SmallProfileCard
            key={user.id}
            id={user.id}
            username={user.username || ''}
            avatar={user.avatar}
            location={parseLocation(user.location)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-6">
          <Button 
            variant="outline"
            disabled={pagination.currentPage === 1}
            onClick={() => fetchUsers(pagination.currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button 
            variant="outline"
            disabled={pagination.currentPage === pagination.totalPages}
            onClick={() => fetchUsers(pagination.currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserResults;
