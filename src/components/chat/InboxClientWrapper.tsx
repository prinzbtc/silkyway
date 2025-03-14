'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ConversationList from '@/components/chat/ConversationList';
import ConversationFeed from '@/components/chat/ConversationFeed';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';

export default function InboxClientWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get conversationId from URL query parameter
  useEffect(() => {
    if (!searchParams) return;
    
    const conversationId = searchParams.get('conversationId');
    if (conversationId) {
      setActiveConversationId(conversationId);
      
      // Verify the conversation exists and user has access to it
      const verifyConversation = async () => {
        try {
          const response = await fetch(`/api/conversations/${conversationId}`);
          if (response.ok) {
            // Conversation exists and user has access
            setLoading(false);
          } else if (response.status === 404) {
            // Conversation doesn't exist or user doesn't have access
            console.error('Conversation not found');
            router.push('/inbox');
          } else {
            throw new Error('Failed to fetch conversation');
          }
        } catch (error) {
          console.error('Error verifying conversation:', error);
          setLoading(false);
        }
      };
      
      if (session?.user?.id) {
        verifyConversation();
      }
    } else {
      setLoading(false);
    }
  }, [searchParams, session?.user?.id, router]);
  
  // Handle conversation selection
  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    router.push(`/inbox?conversationId=${conversationId}`);
  };
  
  // Handle cleanup of empty conversations when leaving the page
  useEffect(() => {
    return () => {
      // When component unmounts, check if there are any empty conversations to clean up
      if (activeConversationId) {
        fetch(`/api/conversations/${activeConversationId}/cleanup`, {
          method: 'DELETE'
        }).catch(error => {
          console.error('Error cleaning up empty conversation:', error);
        });
      }
    };
  }, [activeConversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden h-[calc(100vh-12rem)]">
      <div className="grid grid-cols-1 md:grid-cols-3 h-full">
        <div className="md:col-span-1 border-r border-gray-200 dark:border-gray-800 h-full">
          <ConversationList 
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
          />
        </div>
        <div className="md:col-span-2 h-full">
          {activeConversationId ? (
            <ConversationFeed 
              conversationId={activeConversationId}
            />
          ) : (
            <div className="flex items-center justify-center text-center p-8 h-full">
              <div>
                <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
                <p className="text-gray-500">
                  Choose a conversation from the list or start a new one from a listing page.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
