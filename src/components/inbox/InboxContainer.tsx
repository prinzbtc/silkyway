'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pusherClient } from '@/lib/pusher';
import ConversationList from './ConversationList';
import ConversationFeed from './ConversationFeed';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

import { Conversation } from '@/types/conversation';
import type { Conversation as ChatConversation, ChatUser, Message as ChatMessage } from '@/types/chat';

// Define a union type to handle both conversation formats
type AnyConversation = Conversation | ChatConversation;

// Adapter function to convert between conversation types
const adaptConversationForFeed = (conversation: Conversation): ChatConversation => {
  const otherUser = conversation.otherUser;
  
  // Create a ChatUser from the otherUser
  const chatUser: ChatUser = {
    id: otherUser.id,
    username: otherUser.username,
    avatar: otherUser.avatar
  };
  
  // Determine if the otherUser is the buyer or seller
  const isBuyer = otherUser.id !== conversation.listing?.user.id;
  
  return {
    id: conversation.id,
    createdAt: new Date(conversation.updatedAt), // Use updatedAt as a fallback
    updatedAt: new Date(conversation.updatedAt),
    buyerId: isBuyer ? otherUser.id : 'seller-id', // Placeholder
    sellerId: isBuyer ? 'seller-id' : otherUser.id, // Placeholder
    buyer: isBuyer ? chatUser : conversation.listing?.user as ChatUser,
    seller: isBuyer ? conversation.listing?.user as ChatUser : chatUser,
    messages: conversation.messages as unknown as ChatMessage[],
    unreadCount: conversation.unreadCount,
    _count: conversation._count,
    offers: conversation.offers,
    listing: conversation.listing
  };
};

interface InboxContainerProps {
  conversations: AnyConversation[];
  userId: string;
  initialConversationId?: string;
}

export default function InboxContainer({
  conversations: initialConversations,
  userId,
  initialConversationId,
}: InboxContainerProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<AnyConversation[]>(initialConversations);
  const [selectedConversation, setSelectedConversation] = useState<AnyConversation | null>(null);

  // Function to mark a conversation as read
  const markConversationAsRead = async (conversationId: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  // Effect to set the initial selected conversation if initialConversationId is provided
  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      console.log(`Looking for conversation with ID: ${initialConversationId}`);
      console.log(`Available conversations:`, conversations.map(c => c.id));
      
      const conversation = conversations.find(c => c.id === initialConversationId);
      if (conversation) {
        console.log(`Found and selecting conversation: ${conversation.id}`);
        setSelectedConversation(conversation);
        // Mark conversation as read when selected
        markConversationAsRead(conversation.id);
      } else {
        console.log(`Conversation with ID ${initialConversationId} not found in available conversations`);
        // If we can't find the conversation, try to fetch it directly
        const fetchConversation = async () => {
          try {
            const response = await fetch(`/api/conversations/${initialConversationId}`);
            if (response.ok) {
              const data = await response.json();
              console.log(`Fetched conversation directly:`, data);
              if (data.conversation) {
                setSelectedConversation(data.conversation);
                markConversationAsRead(data.conversation.id);
              }
            }
          } catch (error) {
            console.error(`Error fetching conversation:`, error);
          }
        };
        fetchConversation();
      }
    }
  }, [initialConversationId, conversations]);
  
  // Track if a conversation is newly created and has no messages
  const [newEmptyConversation, setNewEmptyConversation] = useState<string | null>(null);
  
  // Set the newEmptyConversation state when a conversation is selected and has no messages
  useEffect(() => {
    if (selectedConversation && selectedConversation.messages.length === 0) {
      // Only set as empty if it's a new conversation (i.e., from initialConversationId)
      if (initialConversationId && selectedConversation.id === initialConversationId) {
        console.log(`Tracking empty conversation: ${selectedConversation.id}`);
        setNewEmptyConversation(selectedConversation.id);
      }
    } else if (selectedConversation && selectedConversation.messages.length > 0 && newEmptyConversation) {
      // If the selected conversation now has messages, clear the newEmptyConversation state
      if (selectedConversation.id === newEmptyConversation) {
        console.log(`Conversation ${selectedConversation.id} now has messages, no longer tracking as empty`);
        setNewEmptyConversation(null);
      }
    }
  }, [selectedConversation, initialConversationId, newEmptyConversation]);
  
  // Cleanup empty conversations when the user navigates away
  useEffect(() => {
    // Function to delete an empty conversation
    const deleteEmptyConversation = async (conversationId: string) => {
      try {
        console.log(`Attempting to delete empty conversation via fetch: ${conversationId}`);
        const response = await fetch('/api/conversations/delete-empty', {
          method: 'POST', // Changed to POST for better compatibility
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ conversationId })
        });
        
        if (response.ok) {
          console.log(`Successfully deleted empty conversation: ${conversationId}`);
        } else {
          const errorData = await response.json();
          console.error(`Failed to delete conversation: ${response.status}`, errorData);
        }
      } catch (error) {
        console.error('Failed to delete empty conversation:', error);
      }
    };
    
    // Add event listener for beforeunload to clean up empty conversations
    const handleBeforeUnload = () => {
      if (newEmptyConversation) {
        console.log(`Attempting to delete empty conversation via sendBeacon: ${newEmptyConversation}`);
        // Use sendBeacon for more reliable cleanup during page unload
        const data = JSON.stringify({ conversationId: newEmptyConversation });
        const sent = navigator.sendBeacon(
          '/api/conversations/delete-empty',
          new Blob([data], { type: 'application/json' })
        );
        console.log(`SendBeacon result: ${sent ? 'successful' : 'failed'}`);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also attempt to clean up if component unmounts and there's still an empty conversation
      if (newEmptyConversation) {
        console.log(`Component unmounting, cleaning up empty conversation: ${newEmptyConversation}`);
        deleteEmptyConversation(newEmptyConversation);
      }
    };
  }, [newEmptyConversation]);
  
  // Register beforeunload event as soon as we have a new empty conversation
  useEffect(() => {
    if (newEmptyConversation) {
      console.log(`Registered immediate cleanup for empty conversation: ${newEmptyConversation}`);
      
      // Function to delete the empty conversation
      const deleteEmptyConversation = async () => {
        try {
          console.log(`Immediately deleting empty conversation: ${newEmptyConversation}`);
          const response = await fetch('/api/conversations/delete-empty', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ conversationId: newEmptyConversation })
          });
          
          if (response.ok) {
            console.log(`Successfully deleted empty conversation: ${newEmptyConversation}`);
            setNewEmptyConversation(null);
          } else {
            console.error(`Failed to delete empty conversation: ${newEmptyConversation}`);
          }
        } catch (error) {
          console.error(`Error deleting empty conversation:`, error);
        }
      };
      
      // Register visibility change to detect when user leaves the page
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && newEmptyConversation) {
          console.log(`Page hidden, deleting empty conversation: ${newEmptyConversation}`);
          // Use sendBeacon for more reliable cleanup
          const data = JSON.stringify({ conversationId: newEmptyConversation });
          navigator.sendBeacon(
            '/api/conversations/delete-empty',
            new Blob([data], { type: 'application/json' })
          );
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        // Also attempt cleanup when this effect is cleaned up
        if (newEmptyConversation) {
          deleteEmptyConversation();
        }
      };
    }
  }, [newEmptyConversation]);

  useEffect(() => {
    // Subscribe to user's conversation channel
    const channel = pusherClient.subscribe(`user-${userId}`);

    channel.bind('new-message', (data: any) => {
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        if (conversationIndex === -1) return prev;

        const newConversations = [...prev];
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update message count and latest message
        conversation._count = {
          messages: (conversation._count?.messages ?? 0) + (data.senderId !== userId ? 1 : 0)
        };
        conversation.messages = [data.message];
        conversation.updatedAt = new Date().toISOString(); // Convert Date to string for the conversation type

        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);

        return newConversations;
      });
    });

    channel.bind('message-read', (data: any) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              _count: { messages: 0 },
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                viewed: true,
              })),
            };
          }
          return conv;
        })
      );
    });

    channel.bind('new-offer', (data: any) => {
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        if (conversationIndex === -1) return prev;

        const newConversations = [...prev];
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update offers
        conversation.offers = [...(conversation.offers ?? []), data.offer];
        conversation.updatedAt = new Date().toISOString(); // Convert Date to string for the conversation type

        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);

        return newConversations;
      });
    });

    return () => {
      pusherClient.unsubscribe(`user-${userId}`);
    };
  }, [userId]);

  const handleConversationSelect = (conversation: AnyConversation) => {
    setSelectedConversation(conversation);
    
    // Mark messages as read
    if (conversation._count?.messages ?? 0 > 0) {
      markConversationAsRead(conversation.id);
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* Conversation List */}
      <div className="w-80 shrink-0 overflow-y-auto rounded-lg border">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversation?.id ?? null}
          onSelect={handleConversationSelect}
          userId={userId}
        />
      </div>

      {/* Conversation Feed */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        {selectedConversation ? (
          <ConversationFeed
            conversation={'otherUser' in selectedConversation 
              ? adaptConversationForFeed(selectedConversation as Conversation)
              : selectedConversation as ChatConversation}
            userId={userId}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-4 text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Help Button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4"
        onClick={() => router.push('/help')}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
