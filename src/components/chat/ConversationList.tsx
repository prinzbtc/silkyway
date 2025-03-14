'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Conversation } from '@/types/chat';
import ConversationItem from './ConversationItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import useChat from '@/hooks/useChat';

interface ConversationListProps {
  activeConversationId?: string | null;
  onSelectConversation?: (conversationId: string) => void;
}

export default function ConversationList({ 
  activeConversationId: externalActiveConversationId,
  onSelectConversation
}: ConversationListProps) {
  const router = useRouter();
  const { data: session } = useAuth();
  const { subscribe } = useChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [internalActiveConversationId, setInternalActiveConversationId] = useState<string | null>(null);
  
  // Use external activeConversationId if provided, otherwise use internal state
  const activeConversationId = externalActiveConversationId !== undefined ? externalActiveConversationId : internalActiveConversationId;

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        if (!response.ok) throw new Error('Failed to fetch conversations');
        
        const data = await response.json();
        setConversations(data.conversations);
        setFilteredConversations(data.conversations);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchConversations();
    }
  }, [session?.user?.id]);

  // Subscribe to new messages to update conversation list
  useEffect(() => {
    if (!session?.user?.id) return;

    const handleNewMessage = (data: any) => {
      const { conversationId, message } = data;
      
      // Update the conversation list
      setConversations(prevConversations => {
        const updatedConversations = [...prevConversations];
        const conversationIndex = updatedConversations.findIndex(c => c.id === conversationId);
        
        if (conversationIndex !== -1) {
          // Update existing conversation
          const conversation = { ...updatedConversations[conversationIndex] };
          
          // Update unread count if this is not the active conversation
          if (conversationId !== activeConversationId && message.senderId !== session.user?.id) {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;
          }
          
          // Move conversation to top of list
          updatedConversations.splice(conversationIndex, 1);
          updatedConversations.unshift(conversation);
        }
        
        return updatedConversations;
      });
    };

    const handleMessageRead = (data: any) => {
      const { conversationId, readerId } = data;
      
      // Only update if the reader is the current user
      if (readerId === session.user?.id) {
        setConversations(prevConversations => {
          return prevConversations.map(conversation => {
            if (conversation.id === conversationId) {
              return { ...conversation, unreadCount: 0 };
            }
            return conversation;
          });
        });
      }
    };

    const unsubscribeNewMessage = subscribe('new_message', handleNewMessage);
    const unsubscribeMessageRead = subscribe('message_read', handleMessageRead);

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageRead();
    };
  }, [session?.user?.id, activeConversationId, subscribe]);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = conversations.filter(conversation => {
      const buyerName = conversation.buyer?.username?.toLowerCase() || '';
      const sellerName = conversation.seller?.username?.toLowerCase() || '';
      const listingTitle = conversation.listing?.title?.toLowerCase() || '';
      
      return buyerName.includes(query) || 
             sellerName.includes(query) || 
             listingTitle.includes(query);
    });
    
    setFilteredConversations(filtered);
  }, [searchQuery, conversations]);

  // Handle conversation selection
  const handleSelectConversation = (conversationId: string) => {
    setInternalActiveConversationId(conversationId);
    
    if (onSelectConversation) {
      // Use the provided callback if available
      onSelectConversation(conversationId);
    } else {
      // Fall back to default behavior
      router.push(`/inbox?conversationId=${conversationId}`);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold mb-4">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search conversations..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map(conversation => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onClick={() => handleSelectConversation(conversation.id)}
              currentUserId={session?.user?.id || ''}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
            </p>
            {!searchQuery && (
              <Button onClick={() => router.push('/marketplace')}>
                Browse Marketplace
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
