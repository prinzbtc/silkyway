'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSession } from '@/lib/auth/session';

/**
 * Custom hook to manage Socket.IO connection and authentication
 * @returns Object containing the socket instance and connection status
 */
export function useSocketIO() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Create a function to initialize the socket
    const initializeSocket = async () => {
      try {
        // Get the user session to authenticate the socket
        const session = await getSession();
        if (!session?.user?.id) {
          console.error('No authenticated user found for socket connection');
          return;
        }

        // Determine the Socket.IO server URL
        const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || window.location.origin;
        
        // Initialize the socket connection with auth data
        const socketInstance = io(socketUrl, {
          withCredentials: true,
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,  // Increase reconnection attempts
          reconnectionDelay: 1000,
          timeout: 20000,  // Increase connection timeout
          // Pass the userId in the auth object for authentication
          auth: {
            userId: session.user.id
          }
        });
        
        console.log(`Initializing Socket.IO connection to ${socketUrl} for user ${session.user.id}`);

        // Set up event listeners
        socketInstance.on('connect', () => {
          console.log('Socket.IO connected with ID:', socketInstance.id);
          setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
          console.log('Socket.IO disconnected');
          setIsConnected(false);
        });

        socketInstance.on('error', (error) => {
          console.error('Socket.IO error:', error);
          // Don't throw the error to prevent it from bubbling up to the console
          // Attempt to reconnect if not already reconnecting
          if (!socketInstance.disconnected) {
            console.log('Attempting to reconnect after error...');
            socketInstance.disconnect().connect();
          }
        });
        
        socketInstance.on('connect_error', (error) => {
          console.warn('Socket.IO connection error:', error.message);
          // Don't throw the error to prevent generic "server error" in console
          
          // Log more detailed information for debugging
          console.log('Connection error details:', {
            socketId: socketInstance.id,
            connected: socketInstance.connected,
            url: socketUrl,
            userId: session.user.id
          });
        });

        socketInstance.on('reconnect', (attemptNumber) => {
          console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
        });

        // Store the socket instance in state
        setSocket(socketInstance);

        // Clean up on unmount
        return () => {
          console.log('Cleaning up Socket.IO connection');
          socketInstance.disconnect();
        };
      } catch (error) {
        console.error('Error initializing Socket.IO:', error);
      }
    };

    // Initialize the socket
    initializeSocket();
  }, []);

  return { socket, isConnected };
}
