'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Check, Image as ImageIcon, File, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';
import type { Conversation, Message, MessageAttachment, SendMessageInput, ChatListing } from '@/types/chat';
import type { Listing } from '@/types/conversation';
import type { UnifiedConversation } from '@/types/unifiedConversation';
import { useSocket } from '@/hooks/useSocket';
import ListingBanner from './ListingBanner';
import MessageBubble from './MessageBubble';
import OfferCard from './OfferCard';
import ProposePrice from './ProposePrice';

interface ConversationFeedProps {
  conversation: Conversation | UnifiedConversation;
  userId: string;
}

const MAX_MESSAGE_LENGTH = 350;
const MAX_ATTACHMENTS = 5; // Allow up to 5 attachments as per updated requirements
const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024; // 3MB per file as per updated requirements
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function ConversationFeed({
  conversation: initialConversation,
  userId,
}: ConversationFeedProps) {
  // Use state for the conversation to allow updates
  const [conversation, setConversation] = useState<Conversation | UnifiedConversation>(initialConversation);
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>((initialConversation.messages as Message[]) || []);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isProposePriceOpen, setIsProposePriceOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBuyer = conversation.buyer?.id === userId;
  
  // Check if this is a new conversation without messages
  const isNewConversation = conversation.messages.length === 0;
  
  // Function to scroll to the bottom of the message feed
  const scrollToBottom = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  };
  
  // Add a welcome message for new conversations
  useEffect(() => {
    if (isNewConversation) {
      // Auto-focus the message input for new conversations
      setTimeout(() => {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
          messageInput.focus();
        }
      }, 500);
    }
  }, [isNewConversation]);

  // Create preview URLs for selected attachments
  const attachmentPreviews = attachments.map(file => ({
    url: URL.createObjectURL(file),
    name: file.name,
    type: file.type,
    size: file.size
  }));

  // Cleanup preview URLs when attachments change
  useEffect(() => {
    return () => {
      attachmentPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [attachments]);

  // Initialize Socket.IO connection
  const { isConnected, joinConversation, subscribe, sendMessage, markMessagesAsRead } = useSocket(userId);

  // Join the conversation room when connected
  useEffect(() => {
    if (isConnected && conversation.id) {
      console.log(`Joining conversation room: conversation:${conversation.id}`);
      joinConversation(conversation.id);
      
      // Mark messages as read when joining a conversation
      markMessagesAsRead(conversation.id);
      
      // Subscribe to new messages with enhanced handling
      const unsubscribeNewMessage = subscribe('new-message', (data: any) => {
        console.log('Received new-message event:', { 
          conversationId: data.conversationId,
          currentConversationId: conversation.id,
          messageId: data.message?.id,
          senderId: data.message?.senderId,
          isRetry: data.isRetry || false,
          deliveryId: data.deliveryId || 'none'
        });
        
        // Process messages for this conversation or global broadcasts
        if (data.conversationId === conversation.id || data.broadcast === true) {
          // Update messages with improved duplicate detection
          setMessages(prev => {
            // Track processed delivery IDs to prevent duplicates from retry mechanism
            const processedDeliveryIds = new Set(
              prev.filter(m => (m as any).deliveryId).map(m => (m as any).deliveryId)
            );
            
            // Check if this is a retry and we've already processed this message
            if (data.isRetry && data.deliveryId && processedDeliveryIds.has(data.deliveryId)) {
              console.log('Ignoring retry message already processed:', data.deliveryId);
              return prev;
            }
            
            // Enhanced duplicate detection - check by ID and also content+sender combination
            const messageExists = prev.some(m => 
              m.id === data.message.id || 
              ((m as any).deliveryId && (m as any).deliveryId === data.deliveryId) ||
              (m.content === data.message.content && 
               m.senderId === data.message.senderId && 
               Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 5000)
            );
            
            if (messageExists) {
              console.log('Message already exists in state, skipping:', data.message.id);
              return prev;
            }
            
            // Check if this is replacing an optimistic update
            const optimisticIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.content === data.message.content && 
              m.senderId === data.message.senderId
            );
            
            if (optimisticIndex >= 0) {
              console.log('Replacing optimistic message with real message:', {
                tempId: prev[optimisticIndex].id,
                realId: data.message.id
              });
              // Replace the optimistic message with the real one
              const newMessages = [...prev];
              newMessages[optimisticIndex] = {
                ...data.message,
                deliveryId: data.deliveryId // Store deliveryId for duplicate detection
              };
              return newMessages;
            }
            
            console.log('Adding new message to state:', data.message.id);
            // Add the new message with deliveryId for duplicate detection
            return [...prev, {
              ...data.message,
              deliveryId: data.deliveryId
            }];
          });
          
          // If the message is from the other user, mark it as read
          if (data.message.senderId !== userId) {
            console.log('Marking messages as read for conversation:', conversation.id);
            markMessagesAsRead(conversation.id);
          }
          
          // Scroll to bottom when new messages arrive with a slight delay
          // to ensure the DOM has updated with the new message
          setTimeout(scrollToBottom, 100);
          
          // Update the conversation object if it's a new message
          setConversation(prev => ({
            ...prev,
            messages: [...messages, data.message]
          }));
        }
      });
      
      // Subscribe to message read status updates
      const unsubscribeMessageRead = subscribe('message-read', (data: any) => {
        if (data.conversationId === conversation.id) {
          // Update read status for messages
          setMessages(prev => 
            prev.map(message => {
              if (message.senderId === userId && data.readBy !== userId) {
                return { ...message, read: true };
              }
              return message;
            })
          );
        }
      });
      
      // Also subscribe to global messages as a fallback with enhanced handling
      const unsubscribeGlobalMessage = subscribe('global-message', (data: any) => {
        console.log('Received global-message event:', { 
          conversationId: data.conversationId,
          targetRooms: data.targetRooms,
          currentConversationId: conversation.id,
          messageId: data.message?.id,
          isRetry: data.isRetry || false,
          deliveryId: data.deliveryId || 'none'
        });
        
        // Check if this message is intended for this conversation
        const isForThisConversation = data.conversationId === conversation.id;
        const isForThisUser = data.targetRooms?.includes(`user:${userId}`);
        
        if (isForThisConversation || isForThisUser) {
          // Update messages with the same enhanced duplicate detection
          setMessages(prev => {
            // Track processed delivery IDs to prevent duplicates from retry mechanism
            const processedDeliveryIds = new Set(
              prev.filter(m => (m as any).deliveryId).map(m => (m as any).deliveryId)
            );
            
            // Check if this is a retry and we've already processed this message
            if (data.isRetry && data.deliveryId && processedDeliveryIds.has(data.deliveryId)) {
              console.log('Ignoring retry global message already processed:', data.deliveryId);
              return prev;
            }
            
            // Enhanced duplicate detection - check by ID and also content+sender combination
            const messageExists = prev.some(m => 
              m.id === data.message.id || 
              ((m as any).deliveryId && (m as any).deliveryId === data.deliveryId) ||
              (m.content === data.message.content && 
               m.senderId === data.message.senderId && 
               Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 5000)
            );
            
            if (messageExists) {
              console.log('Message already exists in state (from global), skipping:', data.message.id);
              return prev;
            }
            
            // Check if this is replacing an optimistic update
            const optimisticIndex = prev.findIndex(m => 
              m.id.startsWith('temp-') && 
              m.content === data.message.content && 
              m.senderId === data.message.senderId
            );
            
            if (optimisticIndex >= 0) {
              console.log('Replacing optimistic message with real message (from global):', {
                tempId: prev[optimisticIndex].id,
                realId: data.message.id
              });
              // Replace the optimistic message with the real one
              const newMessages = [...prev];
              newMessages[optimisticIndex] = {
                ...data.message,
                deliveryId: data.deliveryId // Store deliveryId for duplicate detection
              };
              return newMessages;
            }
            
            console.log('Adding new message to state (from global):', data.message.id);
            // Add the new message with deliveryId for duplicate detection
            return [...prev, {
              ...data.message,
              deliveryId: data.deliveryId
            }];
          });
          
          // If the message is from the other user, mark it as read
          if (data.message.senderId !== userId) {
            markMessagesAsRead(conversation.id);
          }
          
          // Scroll to bottom when new message arrives with a slight delay
          // to ensure the DOM has updated with the new message
          setTimeout(scrollToBottom, 100);
        }
      });
      
      // Clean up subscriptions on unmount
      return () => {
        unsubscribeNewMessage();
        unsubscribeMessageRead();
        unsubscribeGlobalMessage();
      };
    }
  }, [isConnected, conversation.id, joinConversation, subscribe, userId, markMessagesAsRead, scrollToBottom]);

  // Update messages when conversation changes
  useEffect(() => {
    setMessages(conversation.messages || []);
  }, [conversation]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate total number of attachments
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast({
        title: 'Too many attachments',
        description: `You can only upload ${MAX_ATTACHMENTS} attachments per message`,
        variant: 'destructive',
      });
      return;
    }

    // Validate each file
    const validFiles = files.filter((file) => {
      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported file type`,
          variant: 'destructive',
        });
        return false;
      }

      // Check file size
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 3MB limit`,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    });

    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleSendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;

    if (message.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: 'Message too long',
        description: `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSending(true);
      
      // First upload attachments if any
      let messageAttachments: MessageAttachment[] = [];
      if (attachments.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        
        const formData = new FormData();
        attachments.forEach((file) => formData.append('files', file));

        try {
          const response = await fetch('/api/uploads/medias', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload files: ${errorText}`);
          }
          
          const data = await response.json();
          messageAttachments = data.files.map((file: { url: string; type: string; size: number; name: string }) => ({
            url: file.url,
            type: file.type,
            size: file.size,
            name: file.name
          }));
          
          setUploadProgress(100);
        } catch (error) {
          console.error('Upload error:', error);
          toast({
            title: 'Upload failed',
            description: error instanceof Error ? error.message : 'Failed to upload one or more files',
            variant: 'destructive',
          });
          setIsSending(false);
          setIsUploading(false);
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Get the receiver ID based on whether the current user is buyer or seller
      const receiverId = isBuyer ? conversation.seller?.id : conversation.buyer?.id;
      
      // Find the current user's information from the conversation
      const currentUserInfo = userId === conversation.buyerId 
        ? conversation.buyer 
        : conversation.seller;
      
      // Find the receiver's information from the conversation
      const receiverInfo = userId === conversation.buyerId 
        ? conversation.seller 
        : conversation.buyer;
      
      // Create a temporary optimistic message to show immediately in the UI
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content: message.trim(),
        createdAt: new Date(),
        senderId: userId,
        receiverId: receiverId || '',
        conversationId: conversation.id,
        read: false,
        attachments: messageAttachments,
        sender: {
          id: userId,
          username: currentUserInfo?.username || 'You',
          avatar: currentUserInfo?.avatar || null,
        },
        receiver: {
          id: receiverId || '',
          username: receiverInfo?.username || 'User',
          avatar: receiverInfo?.avatar || null,
        }
      };
      
      console.log('Created optimistic message with sender:', {
        senderId: optimisticMessage.sender.id,
        senderUsername: optimisticMessage.sender.username,
        isSelf: optimisticMessage.sender.id === userId
      });

      // Add the optimistic message to the UI
      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();
      
      // Prepare the message data to send
      const messageData: SendMessageInput = {
        content: message.trim(),
        attachments: messageAttachments,
      };
      
      try {
        console.log('Sending message to conversation:', conversation.id);
        
        // Send the message via API
        const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to send message: ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('Message sent successfully:', responseData.message.id);
        
        // Replace the optimistic message with the real one
        setMessages(prev => prev.map(msg => 
          msg.id === optimisticMessage.id ? responseData.message : msg
        ));
      } catch (error) {
        console.error('Error sending message:', error);
        toast({
          title: 'Error sending message',
          description: 'Please try again later',
          variant: 'destructive',
        });
        throw error; // Re-throw to be caught by the outer catch block
      }
      
      // Clear input
      setMessage('');
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(current => current.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Listing Banner - Always at the top of the conversation feed */}
      <div className="sticky top-0 z-10 bg-white">
        {conversation.listing && (
          <ListingBanner listing={conversation.listing as any} />
        )}
      </div>

      {/* Message Feed */}
      <div
        ref={feedRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
      >
        {isNewConversation && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              This is the beginning of your conversation about {conversation.listing?.title || 'this listing'}.
              Send a message to get started.
            </p>
          </div>
        )}
        
        {messages.map((message: Message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSender={message.senderId === userId}
          />
        ))}
        {(conversation.offers || []).map((offer: any) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            listing={conversation.listing ? (conversation.listing as unknown as Listing) : null}
            isBuyer={isBuyer}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="space-y-4">
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, index) => (
                <div key={index} className="relative">
                  {file.type.startsWith('image/') ? (
                    <div className="relative h-16 w-16">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        fill
                        className="rounded object-cover"
                      />
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 rounded border p-2 pr-8">
                      <File className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[120px]">{file.name}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="absolute right-1 top-1 rounded-full bg-background p-1 text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title="Attach files"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <EmojiPicker
              onEmojiSelect={(emoji) => setMessage((prev) => prev + emoji)}
            />
            <Input
              id="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isNewConversation ? "Send your first message..." : "Type a message..."}
              className="flex-1"
              disabled={isSending}
              autoFocus={isNewConversation}
            />
            {isBuyer && (
              <Button
                variant="outline"
                onClick={() => setIsProposePriceOpen(true)}
                disabled={isSending}
              >
                Make an offer
              </Button>
            )}
            <Button 
              onClick={handleSendMessage} 
              disabled={isSending || (message.trim() === '' && attachments.length === 0)}
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>

          {/* Character Count Warning */}
          {message.length > MAX_MESSAGE_LENGTH && (
            <p className="text-sm text-destructive">
              Message too long ({message.length}/{MAX_MESSAGE_LENGTH} characters)
            </p>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-500">
            Be respectful and avoid sharing sensitive information. For your safety,
            all transactions must be completed through our platform.
          </p>
        </div>
      </div>

      {/* Propose Price Dialog */}
      <ProposePrice
        open={isProposePriceOpen}
        onOpenChange={setIsProposePriceOpen}
        listing={conversation.listing as unknown as Listing}
        conversationId={conversation.id}
      />
    </>
  );
}
