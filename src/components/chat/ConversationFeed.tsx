'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Send, Paperclip, X, Image as ImageIcon, File, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Message, Conversation, MessageAttachment } from '@/types/chat';
import useChat from '@/hooks/useChat';
import { cn } from '@/lib/utils';

interface ConversationFeedProps {
  conversationId?: string;
}

export default function ConversationFeed({ conversationId: propConversationId }: ConversationFeedProps) {
  const { data: session } = useAuth();
  const params = useParams();
  // Use the prop if provided, otherwise fall back to the URL parameter
  const conversationId = propConversationId || (params?.conversationId as string);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    joinConversation,
    leaveConversation,
    sendMessage,
    markMessagesAsRead,
    sendTypingIndicator,
    subscribe,
    typingUsers
  } = useChat();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<Record<string, Message>>({});
  const [counterparty, setCounterparty] = useState<{
    id: string;
    username: string | null;
    avatar: string | null;
  } | null>(null);

  // Fetch conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      if (!conversationId || !session?.user?.id) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/conversations/${conversationId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversation');
        }
        
        const data = await response.json();
        setConversation(data.conversation);
        setMessages(data.conversation.messages || []);
        
        // Determine counterparty
        if (data.conversation.buyerId === session.user.id) {
          setCounterparty(data.conversation.seller);
        } else {
          setCounterparty(data.conversation.buyer);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching conversation:', error);
        toast({
          title: 'Error',
          description: 'Failed to load conversation',
          variant: 'destructive'
        });
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [conversationId, session?.user?.id, toast]);

  // Join conversation room and mark messages as read
  useEffect(() => {
    if (!conversationId || !session?.user?.id) return;
    
    joinConversation(conversationId);
    markMessagesAsRead(conversationId);
    
    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, session?.user?.id, joinConversation, leaveConversation, markMessagesAsRead]);

  // Track if user is scrolling manually
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = Math.abs((target.scrollHeight - target.scrollTop) - target.clientHeight) < 50;
    
    setIsUserScrolling(!isAtBottom);
    
    // Reset the user scrolling state after 5 seconds of inactivity
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 5000);
  }, []);

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId || !session?.user?.id) return;

    const handleNewMessage = async (data: any) => {
      // Only process messages for this conversation
      if (data.conversationId !== conversationId) return;
      
      const newMessage = data.message || data;
      
      // Check if this is a pending message from this user
      if (newMessage.senderId === session.user?.id && pendingMessages[newMessage.tempId]) {
        // Replace the pending message with the confirmed one
        setPendingMessages(prev => {
          const updated = { ...prev };
          delete updated[newMessage.tempId];
          return updated;
        });
      }
      
      // If the message is from another user and doesn't have complete sender info
      // (like avatar), fetch the complete conversation to get updated user info
      if (newMessage.senderId !== session.user?.id && 
          (!newMessage.sender?.avatar || !newMessage.sender?.username)) {
        try {
          // Fetch the latest conversation data to get complete user info
          const response = await fetch(`/api/conversations/${conversationId}`);
          if (response.ok) {
            const data = await response.json();
            // Update conversation with complete data
            setConversation(data.conversation);
            
            // Find the message in the updated conversation data
            const updatedMessage = data.conversation.messages?.find((m: any) => m.id === newMessage.id);
            if (updatedMessage) {
              // Use the updated message with complete sender info
              newMessage.sender = updatedMessage.sender;
            }
          }
        } catch (error) {
          console.error('Error fetching updated conversation data:', error);
        }
      }
      
      // Add the message if it's not already in the list
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        
        const updatedMessages = [...prev, newMessage];
        
        // Auto-scroll to the latest message if the user isn't manually scrolling
        if (!isUserScrolling) {
          setTimeout(() => {
            scrollToLatestMessage('smooth');
          }, 100);
        }
        
        return updatedMessages;
      });
      
      // Mark as read if the message is from the other user
      if (newMessage.senderId !== session.user?.id) {
        markMessagesAsRead(conversationId);
      }
    };

    const unsubscribeNewMessage = subscribe('new_message', handleNewMessage);
    
    return () => {
      unsubscribeNewMessage();
    };
  }, [conversationId, session?.user?.id, pendingMessages, subscribe, markMessagesAsRead]);

  // Function to scroll to the latest message within the container
  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (!messageContainerRef.current || !messagesEndRef.current) return;
    
    const container = messageContainerRef.current;
    container.scrollTop = container.scrollHeight;
  }, []);
  
  // Auto-scroll to the latest message when conversation is loaded
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      // Use setTimeout to ensure the DOM has been updated
      setTimeout(() => {
        scrollToLatestMessage();
      }, 100);
    }
  }, [messages.length, isLoading, scrollToLatestMessage]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Convert files to attachments
    const newAttachments: MessageAttachment[] = [];
    
    Array.from(files).forEach(file => {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive'
        });
        return;
      }
      
      // Create a temporary URL for preview
      const url = URL.createObjectURL(file);
      
      newAttachments.push({
        id: crypto.randomUUID(), // Generate a unique ID for the attachment
        url,
        type: file.type,
        size: file.size,
        name: file.name,
        file, // Keep the original file for upload
        isVirusDetected: false // Default to false until scanned
      });
    });
    
    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      
      // Revoke the object URL to prevent memory leaks
      if (updated[index].url.startsWith('blob:')) {
        URL.revokeObjectURL(updated[index].url);
      }
      
      updated.splice(index, 1);
      return updated;
    });
  };

  // Handle typing indicator
  const handleTyping = () => {
    sendTypingIndicator(conversationId, true);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set a new timeout to stop typing indicator after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(conversationId, false);
    }, 3000);
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && attachments.length === 0) || !session?.user?.id || !conversationId) {
      return;
    }
    
    try {
      setIsSending(true);
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(conversationId, false);
      }
      
      // Prepare attachments for upload
      const uploadPromises = attachments.map(async attachment => {
        if (!attachment.file) return attachment;
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', attachment.file);
        formData.append('conversationId', conversationId);
        
        // Upload the file
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload file');
        }
        
        const data = await response.json();
        
        // Check if virus was detected (using the isVirusDetected flag from the MediaFile interface)
        if (data.isVirusDetected) {
          toast({
            title: 'Security Warning',
            description: `Virus detected in file: ${attachment.name}. The file has been blocked.`,
            variant: 'destructive'
          });
          
          // Return null to filter out this attachment
          return null;
        }
        
        // Return the uploaded file data
        return {
          url: data.url,
          type: attachment.type,
          size: attachment.size,
          name: attachment.name
        };
      });
      
      // Wait for all uploads to complete
      const uploadedAttachments = (await Promise.all(uploadPromises))
        .filter(Boolean) as MessageAttachment[];
      
      // Create a temporary message for optimistic UI update
      const tempId = `temp-${Date.now()}`;
      const tempMessage: Message = {
        id: tempId,
        content: messageInput,
        createdAt: new Date(),
        senderId: session.user.id,
        receiverId: counterparty?.id || '',
        conversationId,
        read: false,
        attachments: uploadedAttachments,
        sender: {
          id: session.user.id,
          username: session.user.name || null,
          avatar: session.user.image || null
        },
        receiver: counterparty || {
          id: '',
          username: null,
          avatar: null
        }
      };
      
      // Add to pending messages for optimistic UI update
      setPendingMessages(prev => ({
        ...prev,
        [tempId]: tempMessage
      }));
      
      // Send the message
      await sendMessage(conversationId, {
        content: messageInput,
        attachments: uploadedAttachments,
        tempId
      });
      
      // Clear input and attachments
      setMessageInput('');
      setAttachments([]);
      
      // Auto-scroll to the latest message
      setTimeout(() => {
        scrollToLatestMessage('smooth');
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
  };

  // Render attachment preview
  const renderAttachmentPreview = (attachment: MessageAttachment, index: number) => {
    const isImage = attachment.type.startsWith('image/');
    
    return (
      <div key={index} className="relative group">
        <div className="border rounded-md p-2 flex items-center space-x-2 bg-gray-50 dark:bg-gray-800">
          {isImage ? (
            <div className="relative h-12 w-12 overflow-hidden rounded">
              <img
                src={attachment.url}
                alt={attachment.name || 'Image attachment'}
                className="object-cover h-full w-full"
              />
            </div>
          ) : (
            <div className="h-12 w-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
              <File size={24} className="text-gray-500 dark:text-gray-400" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {attachment.name || (isImage ? 'Image' : 'File')}
            </p>
            <p className="text-xs text-gray-500">
              {Math.round(attachment.size / 1024)} KB
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => removeAttachment(index)}
          >
            <X size={16} />
          </Button>
        </div>
        
        {/* Show virus warning if detected */}
        {attachment.isVirusDetected && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle size={16} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Virus detected in this file. It has been blocked.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  };

  // Get typing indicator text
  const getTypingIndicatorText = () => {
    const typingUserIds = typingUsers[conversationId] || [];
    const filteredIds = typingUserIds.filter(id => id !== session?.user?.id);
    
    if (filteredIds.length === 0) return null;
    
    // For simplicity, just show "typing..." instead of usernames
    return <div className="text-xs text-gray-500 italic mb-2">typing...</div>;
  };

  // Render message groups
  const renderMessages = () => {
    // Combine regular and pending messages
    const allMessages = [
      ...messages,
      ...Object.values(pendingMessages)
    ].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    if (allMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <p className="text-gray-500 mb-2">No messages yet</p>
          <p className="text-sm text-gray-400">Send a message to start the conversation</p>
        </div>
      );
    }
    
    // Group messages by date
    const messagesByDate: { [date: string]: Message[] } = {};
    
    allMessages.forEach(message => {
      const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
      if (!messagesByDate[date]) {
        messagesByDate[date] = [];
      }
      messagesByDate[date].push(message);
    });
    
    return Object.entries(messagesByDate).map(([date, dateMessages]) => (
      <div key={date} className="mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full">
            {format(new Date(date), 'MMMM d, yyyy')}
          </div>
        </div>
        
        {dateMessages.map(message => (
          <div
            key={message.id}
            className={cn(
              "flex mb-4",
              message.senderId === session?.user?.id ? "justify-end" : "justify-start"
            )}
          >
            {message.senderId !== session?.user?.id && (
              <Avatar className="h-8 w-8 mr-2 mt-1">
                {message.sender?.avatar ? (
                  <AvatarImage src={message.sender.avatar} alt={message.sender?.username || 'User'} />
                ) : null}
                <AvatarFallback>
                  {message.sender?.username?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className={cn(
              "max-w-[70%]",
              message.senderId === session?.user?.id ? "items-end" : "items-start"
            )}>
              <div
                className={cn(
                  "rounded-lg p-3",
                  message.senderId === session?.user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                )}
              >
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.attachments.map((attachment, index) => {
                      const isImage = attachment.type.startsWith('image/');
                      
                      if (isImage) {
                        return (
                          <div key={index} className="rounded-md overflow-hidden">
                            <img
                              src={attachment.url}
                              alt={attachment.name || 'Image attachment'}
                              className="max-w-full h-auto"
                            />
                          </div>
                        );
                      }
                      
                      return (
                        <a
                          key={index}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2 p-2 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                        >
                          <File size={16} />
                          <span className="text-sm truncate">
                            {attachment.name || 'File attachment'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(attachment.size / 1024)} KB
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div
                className={cn(
                  "text-xs text-gray-500 mt-1",
                  message.senderId === session?.user?.id ? "text-right" : "text-left"
                )}
              >
                {format(new Date(message.createdAt), 'h:mm a')}
                {message.senderId === session?.user?.id && (
                  <span className="ml-1">
                    {message.read ? (
                      <span className="text-blue-500">Read</span>
                    ) : (
                      'Sent'
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="text-gray-500 mb-4">Conversation not found</p>
        <Button onClick={() => window.history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Fixed at the top */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center bg-white dark:bg-gray-950 z-10">
        <Avatar className="h-10 w-10 mr-3">
          {counterparty?.avatar ? (
            <AvatarImage src={counterparty.avatar} alt={counterparty?.username || 'User'} />
          ) : null}
          <AvatarFallback>
            {counterparty?.username?.substring(0, 2).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <h2 className="font-medium">{counterparty?.username || 'Unknown User'}</h2>
          
          {conversation.listing && (
            <div className="flex items-center text-sm text-gray-500">
              <span>Listing: {conversation.listing.title}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Message list container with fixed height and scrollable content */}
      <div className="flex-grow overflow-hidden relative" style={{ height: 'calc(100% - 180px)' }}>
        <div 
          ref={messageContainerRef}
          className="absolute inset-0 p-4 custom-scrollbar overflow-y-scroll"
          onScroll={handleScroll}
        >
          {renderMessages()}
          {getTypingIndicatorText()}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Attachments preview - Fixed above input */}
      {attachments.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 bg-white dark:bg-gray-950">
          {attachments.map((attachment, index) => renderAttachmentPreview(attachment, index))}
        </div>
      )}
      
      {/* Message input - Always visible at the bottom */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky bottom-0">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <Textarea
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="min-h-[80px] resize-none"
            />
          </div>
          
          <div className="flex space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip size={20} />
            </Button>
            
            <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            
            <Button
              onClick={handleSendMessage}
              disabled={(!messageInput.trim() && attachments.length === 0) || isSending}
            >
              {isSending ? <Spinner size="sm" /> : <Send size={20} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
