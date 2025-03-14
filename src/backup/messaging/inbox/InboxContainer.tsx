'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConversationList from './ConversationList';
import ConversationFeed from './ConversationFeed';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
// Import the Socket.IO hook
import { useSocketIO } from '@/hooks/useSocketIO';

import { Conversation } from '@/types/conversation';
import type { Conversation as ChatConversation, ChatUser, Message as ChatMessage } from '@/types/chat';
import { UnifiedConversation, isUnifiedConversation } from '@/types/unifiedConversation';

// Define a union type to handle all conversation formats
type AnyConversation = Conversation | ChatConversation | UnifiedConversation;

// Define a type for the component state to avoid type conflicts
type ConversationState = AnyConversation[];

// Create a type guard to check conversation types
function isConversationArray(arr: any[]): arr is Conversation[] {
  return arr.length === 0 || 'otherUser' in arr[0];
}

// Type assertion function to handle type compatibility issues
function assertConversationType<T extends AnyConversation>(conv: T): T {
  return conv as T;
}

// Type guard for ChatConversation
function isChatConversation(conv: AnyConversation): conv is ChatConversation {
  return 'seller' in conv && !('lastMessageAt' in conv);
}

// Type guard for Conversation
function isConversation(conv: AnyConversation): conv is Conversation {
  return 'otherUser' in conv;
}

// Helper function to safely update lastMessageAt
function updateLastMessageAt(conversation: AnyConversation): void {
  if (isUnifiedConversation(conversation)) {
    conversation.lastMessageAt = new Date();
  } else if (isChatConversation(conversation)) {
    // For ChatConversation, add lastMessageAt property
    (conversation as any).lastMessageAt = new Date();
  }
}

// Helper function to safely update seller
function updateSeller(conversation: AnyConversation, seller: any): void {
  if (isUnifiedConversation(conversation)) {
    conversation.seller = seller;
  } else if (isChatConversation(conversation)) {
    (conversation as any).seller = seller;
  }
}

// Adapter function to convert between conversation types
const adaptConversationForFeed = (conversation: Conversation): ChatConversation | UnifiedConversation => {
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
  const [conversations, setConversations] = useState<AnyConversation[]>(initialConversations as AnyConversation[]);
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

  // Initialize Socket.IO connection
  const { socket, isConnected } = useSocketIO();

  // Join user room when socket is connected
  useEffect(() => {
    if (!socket || !isConnected || !userId) return;
    
    console.log(`Joining user room: user:${userId}`);
    socket.emit('join-user', userId);
    
    return () => {
      console.log(`Leaving user room: user:${userId}`);
      socket.emit('leave-user', userId);
    };
  }, [socket, isConnected, userId]);

  useEffect(() => {
    if (!socket) return;
    
    // Handle new messages
    const handleNewMessage = (data: any) => {
      console.log('Received new-message event:', data);
      
      // Check if we have the complete conversation data
      const hasCompleteData = data.conversation && 
                             data.conversation.listing && 
                             data.conversation.buyer && 
                             data.conversation.seller;
      
      console.log('Has complete conversation data:', hasCompleteData, data.conversation);
      
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        
        // Create a new array of conversations
        const newConversations = [...prev];
        
        if (conversationIndex === -1) {
          // If conversation doesn't exist yet, add the new conversation if we have complete data
          if (hasCompleteData) {
            console.log('Adding new conversation to list');
            return [data.conversation, ...prev];
          }
          console.log('Conversation not found in existing list, fetching it');
          return prev;
        }
        
        // Get the existing conversation and create a copy to modify
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update message count and latest message
        conversation._count = {
          messages: (conversation._count?.messages ?? 0) + (data.senderId !== userId ? 1 : 0)
        };
        
        // Keep existing messages and add the new one for the conversation list preview
        if (Array.isArray(conversation.messages)) {
          // If we already have messages, add the new one
          conversation.messages = [...conversation.messages, data.message];
        } else {
          // If we don't have messages yet, initialize with the new one
          conversation.messages = [data.message];
        }
        
        // Update the conversation's timestamp
        conversation.updatedAt = new Date().toISOString();
        
        // Add lastMessageAt for UnifiedConversation type
        updateLastMessageAt(conversation);
        
        // If the data includes conversation details with listing information, update it
        if (hasCompleteData) {
          // For UnifiedConversation type, we can directly use the data
          if (data.conversation.listing) {
            conversation.listing = data.conversation.listing;
          }
          
          // Handle buyer and seller based on conversation type
          if (data.conversation.buyer) {
            if (isConversation(conversation)) {
              // For Conversation type, update the otherUser or buyer as appropriate
              if (conversation.listing?.user?.id !== data.conversation.buyer.id) {
                conversation.otherUser = data.conversation.buyer;
              } else {
                conversation.buyer = data.conversation.buyer;
              }
            } else {
              // For ChatConversation or UnifiedConversation
              conversation.buyer = data.conversation.buyer;
            }
          }
          
          if (data.conversation.seller) {
            if (isConversation(conversation)) {
              // For Conversation type, update the otherUser or seller as appropriate
              if (conversation.listing?.user?.id === data.conversation.seller.id) {
                conversation.otherUser = data.conversation.seller;
              }
            } else {
              // For ChatConversation or UnifiedConversation
              updateSeller(conversation, data.conversation.seller);
            }
          }
        }
        
        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);
        
        return newConversations;
      });
      
      // If this conversation is currently selected, update it with the new message
      if (selectedConversation && data.conversationId === selectedConversation.id) {
        setSelectedConversation(prev => {
          if (!prev) return null;
          
          const updated = { ...prev };
          
          // Add the new message to the existing messages
          if (Array.isArray(updated.messages)) {
            // Check if this message is already in the array (to avoid duplicates)
            const messageExists = updated.messages.some(msg => msg.id === data.message.id);
            if (!messageExists) {
              updated.messages = [...updated.messages, data.message];
            }
          } else {
            updated.messages = [data.message];
          }
          
          // Update with UnifiedConversation data if available
          if (data.conversation) {
            if (data.conversation.listing) {
              updated.listing = data.conversation.listing;
            }
            
            // Handle buyer and seller based on conversation type
            if (data.conversation.buyer) {
              if (isConversation(updated)) {
                // For Conversation type, update the otherUser or buyer as appropriate
                if (updated.listing?.user?.id !== data.conversation.buyer.id) {
                  updated.otherUser = data.conversation.buyer;
                } else {
                  updated.buyer = data.conversation.buyer;
                }
              } else {
                // For ChatConversation or UnifiedConversation
                updated.buyer = data.conversation.buyer;
              }
            }
            
            if (data.conversation.seller) {
              if (isConversation(updated)) {
                // For Conversation type, update the otherUser or seller as appropriate
                if (updated.listing?.user?.id === data.conversation.seller.id) {
                  updated.otherUser = data.conversation.seller;
                }
              } else {
                // For ChatConversation or UnifiedConversation
                updateSeller(updated, data.conversation.seller);
              }
            }
            
            // Update lastMessageAt for UnifiedConversation type
            updateLastMessageAt(updated);
          }
          
          // Update with UnifiedConversation data if available
          if (data.conversation) {
            if (data.conversation.listing) {
              updated.listing = data.conversation.listing;
            }
            if (data.conversation.buyer) {
              updated.buyer = data.conversation.buyer;
            }
            if (data.conversation.seller) {
              // Use type assertion to handle property access safely
              (updated as any).seller = data.conversation.seller;
            }
            // Use type assertion to handle property access safely
            (updated as any).lastMessageAt = new Date().toISOString();
          }
          
          return updated;
        });
      }
    };

    // Handle messages being read
    const handleMessagesRead = (data: any) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === data.conversationId) {
            return {
              ...conv,
              _count: { messages: 0 },
              unreadCount: 0,
              messages: conv.messages.map((msg: any) => ({
                ...msg,
                read: true,
              })),
            };
          }
          return conv;
        })
      );
    };

    // Handle new offers
    const handleNewOffer = (data: any) => {
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        if (conversationIndex === -1) return prev;

        const newConversations = [...prev];
        const conversation = { ...newConversations[conversationIndex] };
        
        // Update offers
        conversation.offers = [...(conversation.offers ?? []), data.offer];
        conversation.updatedAt = new Date().toISOString();
        
        // Update lastMessageAt for UnifiedConversation type
        updateLastMessageAt(conversation);

        // Move conversation to top
        newConversations.splice(conversationIndex, 1);
        newConversations.unshift(conversation);

        return newConversations;
      });
    };

    // Handle conversation updates
    const handleConversationUpdate = (data: any) => {
      if (!data.conversation) return;
      
      setConversations((prev) => {
        const conversationIndex = prev.findIndex((c) => c.id === data.conversationId);
        
        // If conversation doesn't exist, add it
        if (conversationIndex === -1) {
          return [data.conversation, ...prev];
        }
        
        // Otherwise update the existing conversation
        const newConversations = [...prev];
        newConversations[conversationIndex] = {
          ...newConversations[conversationIndex],
          ...data.conversation,
          // Preserve messages if they're not in the update
          messages: data.conversation.messages || newConversations[conversationIndex].messages
        };
        
        return newConversations;
      });
    };

    // Register Socket.IO event listeners
    socket.on('new-message', handleNewMessage);
    socket.on('messages-read', handleMessagesRead);
    socket.on('new-offer', handleNewOffer);
    socket.on('conversation-update', handleConversationUpdate);

    // Clean up event listeners on unmount
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('messages-read', handleMessagesRead);
      socket.off('new-offer', handleNewOffer);
      socket.off('conversation-update', handleConversationUpdate);
    };
  }, [socket, userId, selectedConversation]);

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
          conversations={conversations as any[]}
          selectedId={selectedConversation?.id ?? null}
          onSelect={handleConversationSelect}
          userId={userId}
        />
      </div>

      {/* Conversation Feed */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        {selectedConversation ? (
          <ConversationFeed
            conversation={isConversation(selectedConversation)
              ? adaptConversationForFeed(selectedConversation)
              : (selectedConversation as ChatConversation | UnifiedConversation)}
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
