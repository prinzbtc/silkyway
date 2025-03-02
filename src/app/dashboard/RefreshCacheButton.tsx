'use client';

import { FC, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

export const RefreshCacheButton: FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshCache = async () => {
    try {
      setIsRefreshing(true);
      
      // Call the cache invalidation API
      const response = await fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all' }),
      });
      
      if (response.ok) {
        toast({
          title: 'Cache refreshed',
          description: 'Your listings should now be up to date',
        });
        
        // Force a page refresh to show the updated data
        window.location.reload();
      } else {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error('Error refreshing cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh cache',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleRefreshCache}
      disabled={isRefreshing}
      className="ml-2"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  );
};
