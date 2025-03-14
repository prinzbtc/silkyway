'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Conversation } from '@/types/chat';

// CRITICAL FIX: Define extended conversation type with UI state properties
type ExtendedConversation = Conversation & {
  _forceHideBadge?: boolean;
  _version?: number;
  lastUpdateTimestamp?: number;
};
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
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ExtendedConversation[]>([]);
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
      const { conversationId, readerId, senderId } = data;
      
      console.log('ConversationList received message_read event:', data);
      
      // Always update the conversation list regardless of who read the messages
      // This ensures maximum reliability for real-time updates
      setConversations(prevConversations => {
        return prevConversations.map(conversation => {
          if (conversation.id === conversationId) {
            console.log(`Updating conversation ${conversationId} based on message_read event`);
            
            // Create a new conversation object to trigger React re-render
            const updatedConversation = { ...conversation };
            
            // Case 1: Current user is the reader - update their unread count
            if (readerId === session.user?.id) {
              console.log('Current user is the reader - resetting unread count');
              updatedConversation.unreadCount = 0;
            }
            
            // Case 2: Current user is the sender - mark their messages as read
            if (senderId === session.user?.id) {
              console.log('Current user is the sender - marking messages as read');
              if (updatedConversation.messages) {
                updatedConversation.messages = updatedConversation.messages.map(message => {
                  if (message.senderId === session.user?.id) {
                    return { ...message, read: true };
                  }
                  return message;
                });
              }
            }
            
            // Force a UI update with a timestamp property
            const updatedWithTimestamp = {
              ...updatedConversation,
              lastUpdateTimestamp: Date.now() // Use a valid property name
            };
            
            return updatedWithTimestamp;
          }
          return conversation;
        });
      });
    };

    const unsubscribeNewMessage = subscribe('new_message', handleNewMessage);
    const unsubscribeMessageRead = subscribe('message_read', handleMessageRead);
    
    // CRITICAL FIX: Listen for the special force_update_read_status event
    // This event is specifically emitted to force UI updates for read status
    const unsubscribeForceUpdate = subscribe('force_update_read_status', (data: any) => {
      console.log('CRITICAL FIX: ConversationList received force_update_read_status event:', data);
      const { conversationId, readerId, senderId, otherUserId } = data;
      
      // Force update the conversation list to ensure read status is reflected
      setConversations(prevConversations => {
        return prevConversations.map(conversation => {
          if (conversation.id === conversationId) {
            console.log(`CRITICAL FIX: Force updating conversation ${conversationId}`);
            
            // Create a new conversation object to trigger React re-render
            const updatedConversation = { ...conversation };
            
            // CRITICAL FIX: Always reset unread count when this event is received
            // This is the most reliable way to ensure unread counts are accurate
            if (session.user?.id === readerId) {
              // If current user is the reader, reset their unread count
              console.log('CRITICAL FIX: Current user is reader - resetting unread count to 0');
              updatedConversation.unreadCount = 0;
            } else if (session.user?.id === senderId || session.user?.id === otherUserId) {
              // If current user is the sender or the other user, their messages were read
              console.log('CRITICAL FIX: Current user is sender - marking messages as read');
              // Force unread count to 0 to ensure UI updates
              updatedConversation.unreadCount = 0;
              
              // Add a special flag to force badge hiding in ConversationItem
              updatedConversation._forceHideBadge = true;
            }
            
            // If the conversation has messages, mark them as read
            if (updatedConversation.messages) {
              updatedConversation.messages = updatedConversation.messages.map(message => {
                // Mark ALL messages from current user as read
                if (message.senderId === session.user?.id) {
                  return { ...message, read: true };
                }
                return message;
              });
            }
            
            // Force a UI update with a timestamp property and version
            return {
              ...updatedConversation,
              _version: Date.now(), // Use a property that will trigger re-renders
              lastUpdateTimestamp: Date.now() 
            };
          }
          return conversation;
        });
      });
      
      // CRITICAL FIX: Also update filtered conversations to ensure search results update
      setFilteredConversations(prev => {
        // Return a new array to trigger re-render
        return [...prev];
      });
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageRead();
      unsubscribeForceUpdate();
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
