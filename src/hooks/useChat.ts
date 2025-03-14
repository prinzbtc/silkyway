'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { socketService, SocketEvent } from '@/lib/socket-service';
import { Message, Conversation, SendMessageInput, CreateOfferInput } from '@/types/chat';

type ChatStatus = 'connecting' | 'connected' | 'disconnected';

export function useChat() {
  const { data: session } = useAuth();
  const userId = session?.user?.id;
  const [status, setStatus] = useState<ChatStatus>('disconnected');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize socket connection when user is authenticated
  useEffect(() => {
    if (!userId) return;

    // Initialize the socket connection
    socketService.initialize(userId);
    setStatus('connecting');

    // Set up event listeners
    const unsubscribeConnect = socketService.subscribe('connect', () => {
      setStatus('connected');
    });

    const unsubscribeDisconnect = socketService.subscribe('disconnect', () => {
      setStatus('disconnected');
    });

    // Clean up on unmount
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
    };
  }, [userId]);

  // Join a conversation
  const joinConversation = useCallback((conversationId: string) => {
    if (!userId) return;
    
    socketService.joinConversation(conversationId);
    setActiveConversationId(conversationId);
  }, [userId]);

  // Leave a conversation
  const leaveConversation = useCallback((conversationId: string) => {
    if (!userId) return;
    
    socketService.leaveConversation(conversationId);
    if (activeConversationId === conversationId) {
      setActiveConversationId(null);
    }
  }, [userId, activeConversationId]);

  // Send a message
  const sendMessage = useCallback(async (
    conversationId: string, 
    message: SendMessageInput
  ): Promise<string> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    return socketService.sendMessage(conversationId, message);
  }, [userId]);

  // Mark messages as read
  const markMessagesAsRead = useCallback((conversationId: string) => {
    if (!userId) return;
    
    socketService.markMessagesAsRead(conversationId);
  }, [userId]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((
    conversationId: string, 
    isTyping: boolean
  ) => {
    if (!userId) return;
    
    socketService.sendTypingIndicator(conversationId, isTyping);
  }, [userId]);

  // Create an offer
  const createOffer = useCallback(async (
    conversationId: string, 
    offer: CreateOfferInput
  ): Promise<string> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    return socketService.createOffer(conversationId, offer);
  }, [userId]);

  // Update an offer
  const updateOffer = useCallback(async (
    offerId: string, 
    status: 'accepted' | 'rejected' | 'expired'
  ): Promise<boolean> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    return socketService.updateOffer(offerId, status);
  }, [userId]);

  // Subscribe to a socket event
  const subscribe = useCallback(<T = any>(
    event: SocketEvent, 
    callback: (data: T) => void
  ) => {
    return socketService.subscribe(event, callback);
  }, []);

  // Handle typing indicators
  useEffect(() => {
    if (!userId) return;

    const handleUserTyping = (data: { conversationId: string; userId: string }) => {
      const { conversationId, userId: typingUserId } = data;
      
      // Clear any existing timeout for this user
      if (typingTimeoutRef.current[typingUserId]) {
        clearTimeout(typingTimeoutRef.current[typingUserId]);
      }
      
      // Add user to typing users
      setTypingUsers(prev => {
        const conversationTypers = prev[conversationId] || [];
        if (!conversationTypers.includes(typingUserId)) {
          return {
            ...prev,
            [conversationId]: [...conversationTypers, typingUserId]
          };
        }
        return prev;
      });
      
      // Set timeout to remove user from typing after 3 seconds
      typingTimeoutRef.current[typingUserId] = setTimeout(() => {
        setTypingUsers(prev => {
          const conversationTypers = prev[conversationId] || [];
          return {
            ...prev,
            [conversationId]: conversationTypers.filter(id => id !== typingUserId)
          };
        });
      }, 3000);
    };

    const handleUserStoppedTyping = (data: { conversationId: string; userId: string }) => {
      const { conversationId, userId: typingUserId } = data;
      
      // Clear any existing timeout for this user
      if (typingTimeoutRef.current[typingUserId]) {
        clearTimeout(typingTimeoutRef.current[typingUserId]);
        delete typingTimeoutRef.current[typingUserId];
      }
      
      // Remove user from typing users
      setTypingUsers(prev => {
        const conversationTypers = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: conversationTypers.filter(id => id !== typingUserId)
        };
      });
    };

    const unsubscribeUserTyping = socketService.subscribe('user_typing', handleUserTyping);
    const unsubscribeUserStoppedTyping = socketService.subscribe('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      unsubscribeUserTyping();
      unsubscribeUserStoppedTyping();
      
      // Clear all timeouts
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      typingTimeoutRef.current = {};
    };
  }, [userId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Leave any active conversation
      if (activeConversationId) {
        socketService.leaveConversation(activeConversationId);
      }
    };
  }, [activeConversationId]);

  return {
    status,
    activeConversationId,
    typingUsers,
    joinConversation,
    leaveConversation,
    sendMessage,
    markMessagesAsRead,
    sendTypingIndicator,
    createOffer,
    updateOffer,
    subscribe,
    isConnected: status === 'connected'
  };
}

export default useChat;
