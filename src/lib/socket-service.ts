'use client';

import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Define event types for better type safety
export type SocketEvent = 
  | 'connect'
  | 'disconnect'
  | 'new_message'
  | 'message_read'
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
      console.log('Message read notification:', data);
      this.notifyListeners('message_read', data);
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
   */
  public markMessagesAsRead(conversationId: string): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('Cannot mark messages as read: Socket not connected');
      return;
    }

    this.socket.emit('mark_messages_read', {
      conversationId,
      userId: this.userId,
      timestamp: new Date().toISOString()
    });
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
  private notifyListeners(event: string, data: any): void {
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
