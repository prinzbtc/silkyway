'use client';

import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Define event types for better type safety
export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'new_message'
  | 'message_read'
  | 'messages-read'
  | 'force_update_read_status'  // Add the new special event
  | 'user_typing'
  | 'user_stopped_typing'
  | 'join_conversation'
  | 'leave_conversation'
  | 'offer_created'
  | 'offer_updated';

// Singleton pattern for Socket.IO client
export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private userId: string | null = null;
  private activeConversations: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  /**
   * Initialize the socket connection
   * @param userId The ID of the current user
   */
  public initialize(userId: string): void {
    if (this.socket && this.socket.connected && this.userId === userId) {
      console.log('Socket already initialized and connected');
      return;
    }

    this.userId = userId;
    this.connectionAttempts = 0;

    // Clean up any existing socket
    this.disconnect();

    // Initialize the socket connection
    this.socket = io({
      path: '/api/socket',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      query: { userId }
    });

    // Set up event listeners
    this.setupEventListeners();
    console.log(`Socket initialized for user: ${userId}`);
  }

  /**
   * Set up the socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(`Socket connected with ID: ${this.socket?.id}`);
      this.connectionAttempts = 0;
      
      // Rejoin all active conversations
      this.rejoinConversations();
      
      // Notify listeners
      this.notifyListeners('connect', { socketId: this.socket?.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected. Reason: ${reason}`);
      
      // Notify listeners
      this.notifyListeners('disconnect', { reason });
      
      // Handle reconnection for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.handleReconnection();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleReconnection();
    });

    this.socket.on('new_message', (data) => {
      console.log('Received new message:', data);
      this.notifyListeners('new_message', data);
    });

    this.socket.on('message_read', (data) => {
      console.log('🔴 CRITICAL FIX: Message read notification received:', data);
      // Enhanced logging for debugging
      if (data.senderId) {
        console.log(`🔴 CRITICAL FIX: Messages from user ${data.senderId} were read by ${data.readerId}`);
      }
      
      // CRITICAL FIX: Ensure the data has all necessary fields
      const enhancedData = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
        eventId: data.eventId || `read_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        forceUpdate: true,
        // Add a unique identifier to force UI updates
        _uniqueId: Math.random().toString(36).substring(2, 15),
        _clientTimestamp: Date.now()
      };
      
      console.log('🔴 CRITICAL FIX: Enhanced data for message_read event:', enhancedData);
      
      // CRITICAL FIX: Force immediate UI update with multiple approaches
      // 1. Use queueMicrotask for highest priority
      queueMicrotask(() => {
        console.log('🔴 CRITICAL FIX: Dispatching message_read event via queueMicrotask');
        // Notify all listeners with the message_read event
        this.notifyListeners('message_read', enhancedData);
        
        // CRITICAL FIX: Also dispatch the force_update_read_status event to ensure UI updates
        this.notifyListeners('force_update_read_status', enhancedData);
      });
      
      // 2. Also use setTimeout with 0ms delay as a fallback
      setTimeout(() => {
        console.log('🔴 CRITICAL FIX: Dispatching message_read event via setTimeout(0)');
        this.notifyListeners('message_read', {
          ...enhancedData,
          _dispatchMethod: 'setTimeout_0',
          _dispatchTime: Date.now()
        });
      }, 0);
      
      // 3. Also use a slightly delayed timeout to catch any race conditions
      setTimeout(() => {
        console.log('🔴 CRITICAL FIX: Dispatching message_read event via setTimeout(50)');
        this.notifyListeners('message_read', {
          ...enhancedData,
          _dispatchMethod: 'setTimeout_50',
          _dispatchTime: Date.now()
        });
        this.notifyListeners('force_update_read_status', {
          ...enhancedData,
          _dispatchMethod: 'setTimeout_50',
          _dispatchTime: Date.now()
        });
      }, 50);
    });
    
    this.socket.on('messages-read', (data) => {
      console.log('Messages read notification (dash version):', data);
      
      // Convert to the underscore version for consistency
      const normalizedData = {
        ...data,
        // Ensure we have all the required fields
        conversationId: data.conversationId,
        readerId: data.readerId || this.userId,
        senderId: data.senderId,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      // Force immediate UI update with a high priority microtask
      queueMicrotask(() => {
        console.log('CRITICAL FIX: Dispatching message_read event from dash version to all listeners');
        // Notify all listeners with the message_read event
        this.notifyListeners('message_read', normalizedData);
      });
    });
    
    // CRITICAL FIX: Add listener for the special force_update_read_status event
    this.socket.on('force_update_read_status', (data) => {
      console.log('CRITICAL FIX: Received force_update_read_status event:', data);
      
      // This is a special event that forces UI updates for read status
      // We need to handle it with the highest priority
      queueMicrotask(() => {
        console.log('CRITICAL FIX: Broadcasting force_update_read_status to all listeners');
        
        // First notify with the special event name
        this.notifyListeners('force_update_read_status', data);
        
        // Also notify with the standard message_read event for components that only listen to that
        this.notifyListeners('message_read', data);
        
        // And with the legacy format for maximum compatibility
        this.notifyListeners('messages-read', data);
      });
    });

    this.socket.on('user_typing', (data) => {
      this.notifyListeners('user_typing', data);
    });

    this.socket.on('user_stopped_typing', (data) => {
      this.notifyListeners('user_stopped_typing', data);
    });

    this.socket.on('offer_created', (data) => {
      console.log('New offer created:', data);
      this.notifyListeners('offer_created', data);
    });

    this.socket.on('offer_updated', (data) => {
      console.log('Offer updated:', data);
      this.notifyListeners('offer_updated', data);
    });
  }

  /**
   * Handle socket reconnection
   */
  private handleReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.connectionAttempts++;
    
    if (this.connectionAttempts <= this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(1.5, this.connectionAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.connectionAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.connectionAttempts}`);
        this.initialize(this.userId!);
      }, delay);
    } else {
      console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
    }
  }

  /**
   * Rejoin all active conversations after reconnection
   */
  private rejoinConversations(): void {
    if (!this.socket || !this.socket.connected) return;

    console.log(`Rejoining ${this.activeConversations.size} conversations`);
    this.activeConversations.forEach(conversationId => {
      this.joinConversation(conversationId);
    });
  }

  /**
   * Join a conversation
   * @param conversationId The ID of the conversation to join
   */
  public joinConversation(conversationId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot join conversation: Socket not connected');
      this.activeConversations.add(conversationId);
      return;
    }

    console.log(`Joining conversation: ${conversationId}`);
    this.socket.emit('join_conversation', {
      conversationId,
      userId: this.userId
    });
    
    this.activeConversations.add(conversationId);
  }

  /**
   * Leave a conversation
   * @param conversationId The ID of the conversation to leave
   */
  public leaveConversation(conversationId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot leave conversation: Socket not connected');
      this.activeConversations.delete(conversationId);
      return;
    }

    console.log(`Leaving conversation: ${conversationId}`);
    this.socket.emit('leave_conversation', {
      conversationId,
      userId: this.userId
    });
    
    this.activeConversations.delete(conversationId);
  }

  /**
   * Send a message to a conversation
   * @param conversationId The ID of the conversation
   * @param message The message to send
   * @returns A promise that resolves with the message ID
   */
  public sendMessage(conversationId: string, message: any): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Cannot send message: Socket not connected'));
        return;
      }

      // Generate a temporary ID for optimistic updates
      const tempId = `temp-${uuidv4()}`;
      const deliveryId = uuidv4();
      
      // Add metadata to the message
      const messageWithMetadata = {
        ...message,
        tempId,
        deliveryId,
        senderId: this.userId,
        conversationId,
        timestamp: new Date().toISOString()
      };

      // Send the message
      this.socket.emit('send_message', messageWithMetadata, (response: any) => {
        if (response.success) {
          resolve(response.messageId || tempId);
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });

      // Resolve with the temporary ID for optimistic updates
      resolve(tempId);
    });
  }

  /**
   * Mark messages as read
   * @param conversationId The ID of the conversation
   * @param requestId Optional unique ID to track this specific read request
   */
  public markMessagesAsRead(conversationId: string, requestId?: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot mark messages as read: Socket not connected');
      return;
    }

    // CRITICAL FIX: Create a comprehensive payload with all necessary information
    // This ensures the server has everything it needs to broadcast properly
    const payload = {
      conversationId,
      readerId: this.userId, // The user who is reading the messages
      userId: this.userId,   // For backward compatibility
      timestamp: new Date().toISOString(),
      // Add a unique ID to ensure clients recognize this as a new event
      eventId: requestId || `read_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    
    console.log('CRITICAL FIX: Marking messages as read via socket:', payload);
    
    // CRITICAL FIX: First emit directly to the server to ensure other clients get notified
    this.socket.emit('mark_messages_read', payload);
    
    // CRITICAL FIX: Also emit a direct REST API call to ensure the database is updated
    // This ensures that even if the socket fails, the messages will still be marked as read
    fetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Add a cache-busting parameter to prevent caching
      cache: 'no-store'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to mark messages as read: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('CRITICAL FIX: Successfully marked messages as read via API:', data);
      
      // CRITICAL FIX: After successful API call, force a UI update with the special event
      // This ensures that all clients receive the update
      if (data.otherUserId) {
        // Create a comprehensive data object with all necessary information
        const forceUpdateData = {
          ...payload,
          senderId: data.otherUserId,
          otherUserId: data.otherUserId,
          unreadCount: data.unreadCount || 0,
          // Add forceUpdate flag to ensure UI updates
          forceUpdate: true,
          // Add a timestamp to ensure clients recognize this as a new event
          timestamp: new Date().toISOString()
        };
        
        console.log('CRITICAL FIX: Emitting force_update_read_status event:', forceUpdateData);
        
        // CRITICAL FIX: Emit multiple events to ensure all clients receive the update
        if (this.socket && this.socket.connected) {
          // Emit the special event to force UI updates
          this.socket.emit('force_update_read_status', forceUpdateData);
          
          // Also emit the standard message_read event
          this.socket.emit('message_read', forceUpdateData);
          
          // Also emit a global message event that all clients will receive
          this.socket.emit('global-message', {
            type: 'READ_STATUS_UPDATE',
            data: forceUpdateData,
            targetRooms: ['all'],
            timestamp: Date.now()
          });
        }
        
        // CRITICAL FIX: Notify local listeners with multiple events
        this.notifyListeners('force_update_read_status', forceUpdateData);
        this.notifyListeners('message_read', forceUpdateData);
        
        // Also emit with legacy event name for backward compatibility
        this.notifyListeners('messages-read', forceUpdateData);
      }
    })
    .catch(error => {
      console.error('CRITICAL FIX: Failed to mark messages as read via REST API:', error);
    });
    
    // CRITICAL FIX: Immediately update the UI for this client
    // This provides instant feedback even before the server responds
    queueMicrotask(() => {
      console.log('CRITICAL FIX: Locally emitting message_read event for immediate UI update');
      
      // For the current user who is reading messages, we need to simulate a message_read event
      // We need to make sure ALL messages in the conversation are marked as read
      this.notifyListeners('message_read', {
        ...payload,
        // For the local UI update, we need to set senderId to null to ensure all messages
        // are marked as read in the UI regardless of who sent them
        senderId: null,
        // Add forceUpdate flag to ensure UI updates
        forceUpdate: true
      });
      
      // Also emit the legacy format for maximum compatibility
      this.notifyListeners('messages-read', payload);
      
      // CRITICAL FIX: Also emit the special force update event
      this.notifyListeners('force_update_read_status', {
        ...payload,
        // This special event will force the UI to update regardless of sender/reader
        forceUpdate: true
      });
    });
    
    console.log('CRITICAL FIX: Emitted mark_messages_read event with enhanced payload and immediate UI update');
  }

  /**
   * Send a typing indicator
   * @param conversationId The ID of the conversation
   * @param isTyping Whether the user is typing
   */
  public sendTypingIndicator(conversationId: string, isTyping: boolean): void {
    if (!this.socket || !this.socket.connected) return;

    const event = isTyping ? 'user_typing' : 'user_stopped_typing';
    this.socket.emit(event, {
      conversationId,
      userId: this.userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create an offer
   * @param conversationId The ID of the conversation
   * @param offer The offer details
   */
  public createOffer(conversationId: string, offer: any): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Cannot create offer: Socket not connected'));
        return;
      }

      // Generate a temporary ID for optimistic updates
      const tempId = `temp-offer-${uuidv4()}`;
      
      // Add metadata to the offer
      const offerWithMetadata = {
        ...offer,
        tempId,
        senderId: this.userId,
        conversationId,
        timestamp: new Date().toISOString()
      };

      // Send the offer
      this.socket.emit('create_offer', offerWithMetadata, (response: any) => {
        if (response.success) {
          resolve(response.offerId || tempId);
        } else {
          reject(new Error(response.error || 'Failed to create offer'));
        }
      });

      // Resolve with the temporary ID for optimistic updates
      resolve(tempId);
    });
  }

  /**
   * Update an offer
   * @param offerId The ID of the offer
   * @param status The new status of the offer
   */
  public updateOffer(offerId: string, status: 'accepted' | 'rejected' | 'expired'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Cannot update offer: Socket not connected'));
        return;
      }

      this.socket.emit('update_offer', {
        offerId,
        status,
        userId: this.userId,
        timestamp: new Date().toISOString()
      }, (response: any) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to update offer'));
        }
      });
    });
  }

  /**
   * Subscribe to a socket event
   * @param event The event to subscribe to
   * @param callback The callback function
   * @returns A function to unsubscribe
   */
  public subscribe(event: SocketEvent, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)!.add(callback);
    
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Notify all listeners of an event
   * @param event The event that occurred
   * @param data The event data
   */
  public notifyListeners(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Disconnect the socket
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    console.log('Socket disconnected');
  }

  /**
   * Check if the socket is connected
   * @returns Whether the socket is connected
   */
  public isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }
}

// Export a singleton instance
export const socketService = SocketService.getInstance();
