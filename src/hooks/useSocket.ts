import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initialize the Socket.IO connection
  useEffect(() => {
    if (!userId) return;

    // Initialize the socket connection
    const initSocket = async () => {
      try {
        console.log('Initializing Socket.IO connection for user:', userId);
        
        // First, ping the socket API endpoint to initialize the server
        const response = await fetch('/api/socket');
        if (!response.ok) {
          console.error(`Socket server initialization failed with status: ${response.status}`);
          // Continue anyway - the socket might still work
        }
        
        // Create a new socket connection with improved configuration
        const socket = io({
          path: '/api/socket',
          autoConnect: true,
          transports: ['polling', 'websocket'], // Start with polling, then upgrade to websocket if possible
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: true, // Force a new connection to avoid reusing a broken one
          withCredentials: true, // Send cookies for authentication
          auth: { userId }
        });

      // Set up event listeners
      socket.on('connect', () => {
        console.log(`Socket connected with ID: ${socket.id}`);
        setIsConnected(true);
        
        // Join user's room immediately after connecting
        socket.emit('join-user', userId);
      });

      socket.on('disconnect', (reason) => {
        console.log(`Socket disconnected. Reason: ${reason}`);
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
      
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
      
      socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
      });
      
      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Socket reconnection attempt #${attemptNumber}`);
      });

      // Store the socket instance
      socketRef.current = socket;

      // Clean up on unmount
      return () => {
        console.log('Cleaning up Socket.IO connection');
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Error initializing Socket.IO:', error);
      // Retry connection after a delay
      setTimeout(() => {
        console.log('Retrying Socket.IO connection...');
        initSocket();
      }, 3000);
    }
  };

  // Initialize socket and set up retry mechanism
  initSocket();
  }, [userId]);

  // Join a conversation room
  const joinConversation = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join-conversation', conversationId);
    }
  }, [isConnected]);

  // Leave a conversation room
  const leaveConversation = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave-conversation', conversationId);
    }
  }, [isConnected]);

  // Send a message to a conversation
  const sendMessage = useCallback((conversationId: string, message: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('send-message', { conversationId, message });
    }
  }, [isConnected]);

  // Subscribe to events
  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  // Mark messages as read
  const markMessagesAsRead = useCallback((conversationId: string) => {
    if (socketRef.current && isConnected && userId) {
      console.log(`Marking messages as read in conversation: ${conversationId}`);
      // Make API call to mark messages as read
      fetch(`/api/conversations/${conversationId}/view`, {
        method: 'POST',
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to mark messages as read');
        }
        return response.json();
      })
      .then(data => {
        console.log('Messages marked as read:', data);
        
        // Emit the message-read event directly from the client
        // This avoids server-side Socket.IO connection issues
        if (socketRef.current && data.success) {
          console.log(`Emitting message-read event for conversation: ${conversationId}`);
          socketRef.current.emit('message-read', {
            conversationId,
            readBy: userId
          });
        }
      })
      .catch(error => {
        console.error('Error marking messages as read:', error);
      });
    }
  }, [isConnected, userId]);

  return {
    isConnected,
    socket: socketRef.current,
    joinConversation,
    leaveConversation,
    sendMessage,
    subscribe,
    markMessagesAsRead,
  };
};
