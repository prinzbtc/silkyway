'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Send, Paperclip, X, Image as ImageIcon, File, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
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
  // CRITICAL FIX: Add a state variable to force re-renders when read status changes
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
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
    
    // Mark messages as read when conversation is opened
    const markAsRead = async () => {
      await markMessagesAsRead(conversationId);
      console.log('Marked messages as read on conversation open');
    };
    
    markAsRead();
    
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
        const markAsRead = async () => {
          await markMessagesAsRead(conversationId);
          console.log('Marked messages as read after receiving new message');
        };
        markAsRead();
      }
    };

    // Handle message read events
    const handleMessageRead = (data: any) => {
      // Only process events for the current conversation
      if (data.conversationId !== conversationId) {
        return;
      }
      
      // Directly modify the DOM to force the read status to update
      // This approach bypasses React's state management for immediate UI updates
      try {
        const sentStatusElements = document.querySelectorAll('.message-status');
        
        sentStatusElements.forEach(element => {
          if (element.textContent === 'Sent') {
            element.textContent = 'Read';
            element.classList.add('text-blue-500');
          }
        });
      } catch (error) {
        console.error('Error updating DOM directly:', error);
      }
      
      // Update ALL messages in this conversation
      setMessages(prevMessages => {
        // Create a new array to trigger React re-render
        const updatedMessages = prevMessages.map(message => {
          // Mark ALL messages as read regardless of sender to ensure the UI updates
          return { 
            ...message, 
            read: true,
            // Add unique identifiers to force React to see this as a new object
            _readTimestamp: Date.now(),
            _version: Math.random().toString(36).substring(2, 9),
            _uniqueId: `${message.id}_${Date.now()}`,
            _forceUpdate: true
          };
        });
        
        // Force a component re-render
        setLastUpdate(Date.now());
        
        return updatedMessages;
      });
      
      // Force multiple re-renders at different intervals to ensure UI updates
      setTimeout(() => {
        setLastUpdate(Date.now());
      }, 50);
      
      setTimeout(() => {
        setLastUpdate(Date.now() + 1);
      }, 200);
      
      setTimeout(() => {
        setLastUpdate(Date.now() + 2);
      }, 500);
      
      // Force a complete refresh of the messages state
      setTimeout(() => {
        // Create an entirely new array with all messages marked as read
        setMessages(prevMessages => 
          prevMessages.map(msg => ({
            ...msg,
            read: true,
            _forceUpdate: true,
            _timestamp: Date.now()
          }))
        );
      }, 300);
    };
    
    const unsubscribeNewMessage = subscribe('new_message', handleNewMessage);
    // Listen for the message_read event (the server uses underscore version)
    const unsubscribeMessageRead = subscribe('message_read', handleMessageRead);
    
    // Listen for the special force_update_read_status event
    // This event is specifically emitted to force UI updates for read status
    const unsubscribeForceUpdate = subscribe('force_update_read_status', (data: any) => {
      // Only process events for the current conversation
      if (data.conversationId !== conversationId) {
        return;
      }
      
      // Directly modify the DOM to force the read status to update
      try {
        const sentStatusElements = document.querySelectorAll('.message-status');
        
        sentStatusElements.forEach(element => {
          if (element.textContent === 'Sent') {
            element.textContent = 'Read';
            element.classList.add('text-blue-500');
          }
        });
      } catch (error) {
        console.error('Error updating DOM directly:', error);
      }
      
      // CRITICAL FIX: Force update ALL messages to be marked as read
      // regardless of their current read status to ensure UI updates
      setMessages(prevMessages => {
        // Create a new array with updated messages to trigger React re-render
        const updatedMessages = prevMessages.map(message => {
          // CRITICAL FIX: ALWAYS update ALL messages regardless of sender
          // to force a UI update
          console.log(`CRITICAL FIX: Force marking message ${message.id} as read`);
          // Create a completely new message object to ensure React detects the change
          return { 
            ...message, 
            read: true, 
            // Add multiple unique identifiers to force React re-render
            _forceUpdateTimestamp: Date.now(),
            _version: Math.random(),
            _uniqueId: `${message.id}_${Date.now()}`,
            _forceUpdate: true
          };
        });
        
        // Force a component re-render
        setLastUpdate(Date.now());
        
        // Schedule multiple re-renders
        setTimeout(() => setLastUpdate(Date.now() + 1), 50);
        setTimeout(() => setLastUpdate(Date.now() + 2), 150);
        setTimeout(() => setLastUpdate(Date.now() + 3), 300);
        
        return updatedMessages;
      });
      
      // Force another update after a delay
      setTimeout(() => {
        // Create an entirely new array with all messages marked as read
        setMessages(prevMessages => 
          prevMessages.map(msg => ({
            ...msg,
            read: true,
            _forceUpdate: true,
            _timestamp: Date.now()
          }))
        );
        setLastUpdate(Date.now() + 10);
      }, 200);
    // Also force a full component re-render after a short delay
    // This ensures the UI updates even if React doesn't detect the state changes
    setTimeout(() => {
      setLastUpdate(Date.now());
    }, 100);
    });
    
    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageRead();
      unsubscribeForceUpdate();
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
      
      // When lastUpdate changes, ensure read status is updated in the DOM
      if (lastUpdate) {
        // Directly modify the DOM to ensure read status is updated
        try {
          const sentStatusElements = document.querySelectorAll('.message-status');
          
          sentStatusElements.forEach(element => {
            if (element.textContent === 'Sent') {
              element.textContent = 'Read';
              element.classList.add('text-blue-500');
            }
          });
        } catch (error) {
          console.error('Error updating DOM directly:', error);
        }
      }
    }
  }, [messages.length, isLoading, scrollToLatestMessage, lastUpdate]); // CRITICAL FIX: Add lastUpdate to dependencies

  // State for tracking processing attachments
  const [processingAttachments, setProcessingAttachments] = useState<{[key: string]: boolean}>({});
  // Track which attachments have been finalized and sent (to avoid cleanup)
  const [sentAttachmentFilenames, setSentAttachmentFilenames] = useState<string[]>([]);
  
  // Define a variable to track processing states
  const processingStates: Record<string, boolean> = {};
  
  // Function to process an attachment (scan and compress)
  const processAttachment: (attachment: MessageAttachment) => void = (attachment) => {
    const file = attachment.file;
    
    if (!file) {
      console.error('No file object in attachment:', attachment);
      return;
    }
    
    // Mark attachment as processing
    setProcessingAttachments(prev => {
      const updated = { ...prev, [attachment.id]: true };
      console.log(`Setting processing state for ${attachment.id} to true:`, updated);
      return updated;
    });
    
    // Create and execute an async function immediately
    void (async function processFileAsync() {
      console.log(`Starting async processing for ${attachment.id}:`, file.name);
      try {
        console.log(`Processing attachment ${attachment.id} (${file.name})...`);
        
        // Create FormData for file upload and scanning
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'general');
        formData.append('scanOnly', 'true'); // Only scan, don't move to final location yet
        
        console.log('FormData created with file:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        // Upload and scan the file
        console.log(`Uploading file ${file.name} for scanning...`);
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        console.log(`Upload response status for ${file.name}:`, response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Check if virus was detected
          if (errorData.error && errorData.error.includes('Virus detected')) {
            // Update attachment to show virus detected
            setAttachments(prev => prev.map(att => 
              att.id === attachment.id 
                ? { ...att, isVirusDetected: true, isProcessing: false }
                : att
            ));
            
            // Show toast notification for virus detection
            toast({
              title: 'Virus Detected',
              description: `The file "${attachment.name}" contains a virus and cannot be sent.`,
              variant: 'destructive'
            });
            
            // Clear the processing flag in our local tracking object
            processingStates[attachment.id] = false;
            console.log('Updated processingStates object:', processingStates);
          } else {
            // Handle other errors
            toast({
              title: 'Upload Error',
              description: `Failed to process file: ${errorData.error || 'Unknown error'}`,
              variant: 'destructive'
            });
            
            // Remove this attachment
            setAttachments(prev => prev.filter(att => att.id !== attachment.id));
          }
        } else {
          // Process the successful response
          const data = await response.json();
          console.log(`Upload response data for ${file.name}:`, data);
          
          if (data.success) {
            // Update the attachment with the server URL
            setAttachments(prev => prev.map(att => 
              att.id === attachment.id
                ? { 
                    ...att, 
                    url: data.url, 
                    isProcessing: false,
                    isVirusDetected: false,
                    tempUrl: data.url,
                    tempFilename: data.filename,
                    isCompressed: data.compressionFailed === false
                  }
                : att
            ));
            
            console.log(`File ${file.name} processed successfully:`, data);
          } else {
            console.error(`File ${file.name} processing failed:`, data);
            
            // Show error toast
            toast({
              title: 'Upload Error',
              description: data.error || 'Failed to process file',
              variant: 'destructive'
            });
            
            // Remove this attachment
            setAttachments(prev => prev.filter(att => att.id !== attachment.id));
          }
        }
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: 'Upload Error',
          description: 'Failed to process file. Please try again.',
          variant: 'destructive'
        });
        
        // Remove this attachment on error
        setAttachments(prev => prev.filter(att => att.id !== attachment.id));
      } finally {
        // Update processing state
        setProcessingAttachments(prev => {
          const updated = { ...prev, [attachment.id]: false };
          console.log(`Final processing state for ${attachment.id}:`, updated);
          return updated;
        });
      }
    })().catch(error => {
      console.error('Error in processFile:', error);
    });
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('File selection event triggered');
    
    // Get the files from the input element
    const files = e.target.files;
    
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    console.log(`File selection triggered with ${files.length} files`);
    
    // Convert files to attachments with loading state
    const newAttachments: MessageAttachment[] = [];
    
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
    
    // Process each file
    for (const file of Array.from(files)) {
      // Check file size (limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive'
        });
        continue;
      }
      
      console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
      
      // Create a temporary URL for preview
      const url = URL.createObjectURL(file);
      const attachmentId = crypto.randomUUID();
      
      // Add to attachments with loading state
      const newAttachment: MessageAttachment = {
        id: attachmentId,
        url,
        type: file.type,
        size: file.size,
        name: file.name,
        file, // Keep the original file for upload
        isVirusDetected: false, // Default to false until scanned
        isProcessing: true // Set to true while scanning/processing
      };
      
      newAttachments.push(newAttachment);
      
      // Update the processing state tracking
      setProcessingAttachments(prev => {
        const updated = { ...prev, [attachmentId]: true };
        console.log(`Updated processing states for ${attachmentId}:`, updated);
        return updated;
      });
      
      // Process the file immediately (scan and compress) using an IIFE with async/await
      (async () => {
        try {
          console.log(`Processing attachment ${attachmentId} (${file.name})...`);
          
          // Create FormData for file upload and scanning
          const formData = new FormData();
          formData.append('file', file);
          formData.append('purpose', 'general');
          formData.append('scanOnly', 'true'); // Only scan, don't move to final location yet
          
          // Upload and scan the file
          console.log(`Uploading file ${file.name} for scanning...`);
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Check if virus was detected
            if (errorData.error && errorData.error.includes('Virus detected')) {
              // Update attachment to show virus detected
              setAttachments(prev => prev.map(att => 
                att.id === attachmentId 
                  ? { ...att, isVirusDetected: true, isProcessing: false }
                  : att
              ));
              
              toast({
                title: 'Security Warning',
                description: `Virus detected in file: ${file.name}. The file has been blocked.`,
                variant: 'destructive'
              });
            } else {
              // Handle other errors
              toast({
                title: 'Upload Error',
                description: `Failed to process file: ${errorData.error || 'Unknown error'}`,
                variant: 'destructive'
              });
              
              // Remove this attachment
              setAttachments(prev => prev.filter(att => att.id !== attachmentId));
            }
          } else {
            // File scanned successfully
            const data = await response.json();
            
            // Debug log the response data
            console.log(`File scan response for ${attachmentId}:`, data);
            
            // Create a new updated attachment object
            const updatedAttachment: MessageAttachment = {
              id: attachmentId,
              // Use the full URL for the image source
              url: new URL(data.url, window.location.origin).href,
              type: file.type,
              size: file.size,
              name: file.name,
              tempUrl: data.url,
              tempFilename: data.filename,
              isProcessing: false, // No longer processing
              isVirusDetected: false,
              isCompressed: data.compressionFailed === false
            };
            
            console.log(`Updating attachment ${attachmentId} to:`, updatedAttachment);
            
            // Update both state variables
            setAttachments(prev => {
              // Create a new array with the updated attachment
              const updated = prev.map(att => 
                att.id === attachmentId ? updatedAttachment : att
              );
              console.log('New attachments array:', updated);
              return updated;
            });
            
            // Update the processing state tracking
            setProcessingAttachments(prev => {
              const updated = { ...prev, [attachmentId]: false };
              console.log('New processing states:', updated);
              return updated;
            });
            
            // Clear the processing flag in our local tracking object
            processingStates[attachmentId] = false;
            console.log('Updated processingStates object:', processingStates);
          }
        } catch (error) {
          console.error('Error processing file:', error);
          toast({
            title: 'Upload Error',
            description: 'Failed to process file. Please try again.',
            variant: 'destructive'
          });
          
          // Remove this attachment on error
          setAttachments(prev => prev.filter(att => att.id !== attachmentId));
        } finally {
          // Update processing state
          processingStates[attachmentId] = false;
          setProcessingAttachments(prev => ({
            ...prev,
            [attachmentId]: false
          }));
        }
      })().catch(error => {
        console.error('Unhandled error in file processing:', error);
      });
    }
    
    // Add all attachments to state FIRST, before processing
    // This ensures the UI shows the attachments immediately
    setAttachments(prev => {
      const updated = [...prev, ...newAttachments];
      console.log('Updated attachments array with new attachments:', updated);
      return updated;
    });
    
  // Async function to process an attachment (scan and compress)
  const processAttachment = (attachment: MessageAttachment) => {
    const file = attachment.file;
    
    if (!file) {
      console.error('No file object in attachment:', attachment);
      return;
    }
    
    // Create and execute an async function immediately
    void (async function processFileAsync() {
      console.log(`Starting async processing for ${attachment.id}:`, file.name);
      try {
        console.log(`Processing attachment ${attachment.id} (${file.name})...`);
        
        // Create FormData for file upload and scanning
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'general');
        formData.append('scanOnly', 'true'); // Only scan, don't move to final location yet
        
        console.log('FormData created with file:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        // Upload and scan the file
        console.log(`Uploading file ${file.name} for scanning...`);
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        console.log(`Upload response status for ${file.name}:`, response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Check if virus was detected
            if (errorData.error && errorData.error.includes('Virus detected')) {
              // Update attachment to show virus detected
              setAttachments(prev => prev.map(att => 
                att.id === attachment.id 
                  ? { ...att, isVirusDetected: true, isProcessing: false }
                  : att
              ));
              
              toast({
                title: 'Security Warning',
                description: `Virus detected in file: ${file.name}. The file has been blocked.`,
                variant: 'destructive'
              });
            } else {
              // Handle other errors
              toast({
                title: 'Upload Error',
                description: `Failed to process file: ${errorData.error || 'Unknown error'}`,
                variant: 'destructive'
              });
              
              // Remove this attachment
              setAttachments(prev => prev.filter(att => att.id !== attachment.id));
            }
          } else {
            // File scanned successfully
            const data = await response.json();
            
            // Debug log the response data
            console.log(`File scan response for ${attachment.id}:`, data);
            
            // Create a new updated attachment object
            const updatedAttachment: MessageAttachment = {
              id: attachment.id,
              // Use the full URL for the image source
              url: new URL(data.url, window.location.origin).href,
              type: file.type,
              size: file.size,
              name: file.name,
              tempUrl: data.url,
              tempFilename: data.filename,
              isProcessing: false, // No longer processing
              isVirusDetected: false,
              isCompressed: data.compressionFailed === false
            };
            
            console.log(`Updating attachment ${attachment.id} to:`, updatedAttachment);
            
            // Update the attachment in state
            setAttachments(prev => {
              const updated = prev.map(att => 
                att.id === attachment.id ? updatedAttachment : att
              );
              console.log('New attachments array:', updated);
              return updated;
            });
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          toast({
            title: 'Upload Error',
            description: `Failed to process file ${file.name}. Please try again.`,
            variant: 'destructive'
          });
          
          // Remove this attachment on error
          setAttachments(prev => prev.filter(att => att.id !== attachment.id));
          console.log(`Removed attachment ${attachment.id} due to error`);
        } finally {
          // Update processing state
          setProcessingAttachments(prev => {
            const updated = { ...prev, [attachment.id]: false };
            console.log(`Final processing state for ${attachment.id}:`, updated);
            return updated;
          });
        }
      })().catch(error => {
        console.error('Error in processFile:', error);
      });
    }
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an attachment
  const removeAttachment = (index: number) => {
    // Get the attachment before removing it
    const attachment = attachments[index];
    console.log('Removing attachment:', attachment);
    
    // If the attachment is still processing, update the processing state immediately
    if (attachment && attachment.isProcessing) {
      console.log('Stopping processing for attachment:', attachment.id);
      setProcessingAttachments(prevState => {
        const newState = { ...prevState };
        newState[attachment.id] = false;
        return newState;
      });
    }
    
    // Clean up the temporary file on the server if it exists
    if (attachment && attachment.tempFilename) {
      console.log(`Cleaning up temporary file: ${attachment.tempFilename}`);
      cleanupTemporaryFile(attachment.tempFilename);
    }
    
    // Now update the attachments array
    setAttachments(prev => {
      const updated = [...prev];
      
      // Revoke the object URL to prevent memory leaks
      if (attachment && attachment.url && attachment.url.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
      
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Clean up temporary files on the server
  const cleanupTemporaryFile = async (filename: string) => {
    try {
      // Skip cleanup if this file has been finalized and sent in a message
      if (sentAttachmentFilenames.includes(filename)) {
        console.log(`Skipping cleanup for sent attachment: ${filename}`);
        return;
      }

      const response = await fetch('/api/upload/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tempFilenames: [filename]
        })
      });
      
      if (response.ok) {
        console.log(`Successfully cleaned up file: ${filename}`);
      } else {
        console.error(`Failed to clean up file: ${filename}`);
      }
    } catch (error) {
      console.error('Error cleaning up temporary file:', error);
    }
  };
  
  // Clean up temporary files when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any temporary files that weren't sent
      attachments.forEach(attachment => {
        // Revoke object URLs to prevent memory leaks
        if (attachment.url && attachment.url.startsWith('blob:')) {
          URL.revokeObjectURL(attachment.url);
        }
        
        // Clean up temporary files on the server
        if (attachment.tempFilename) {
          console.log(`Cleaning up temporary file on unmount: ${attachment.tempFilename}`);
          cleanupTemporaryFile(attachment.tempFilename);
        }
      });
    };
  }, [attachments]);

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
    
    // Check if any attachments are still processing
    const isAnyAttachmentProcessing = attachments.some(attachment => attachment.isProcessing);
    if (isAnyAttachmentProcessing) {
      toast({
        title: 'Please wait',
        description: 'Some attachments are still being processed',
        variant: 'default'
      });
      return;
    }
    
    // Check if any attachments have viruses
    const hasVirusAttachments = attachments.some(attachment => attachment.isVirusDetected);
    if (hasVirusAttachments) {
      toast({
        title: 'Cannot send message',
        description: 'Please remove infected attachments before sending',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsSending(true);
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingIndicator(conversationId, false);
      }
      
      // Finalize attachments (move from temp to permanent storage)
      const finalizePromises = attachments.map(async attachment => {
        // If attachment was already processed and has a temp URL, finalize it
        if (attachment.tempUrl && attachment.tempFilename) {
          // Create FormData for finalizing the upload
          const formData = new FormData();
          formData.append('tempFilename', attachment.tempFilename);
          formData.append('purpose', 'general');
          formData.append('finalize', 'true');
          
          // Finalize the file (move from temp to permanent storage)
          const response = await fetch('/api/upload/finalize', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error('Failed to finalize file upload');
          }
          
          const data = await response.json();
          
          // Return the finalized attachment data
          return {
            url: data.url, // This will be the permanent URL (/api/media/[filename])
            type: attachment.type,
            size: attachment.size,
            name: data.originalFilename || attachment.name,
            isCompressed: attachment.isCompressed
          };
        } 
        // For attachments that don't have temp URLs (e.g., already uploaded files)
        else if (!attachment.file) {
          // Just return the attachment as is
          return {
            url: attachment.url,
            type: attachment.type,
            size: attachment.size,
            name: attachment.name
          };
        }
        // For attachments that weren't pre-processed (fallback)
        else {
          console.warn('Attachment was not pre-processed, processing now:', attachment.name);
          
          // Create FormData for direct upload and finalization
          const formData = new FormData();
          formData.append('file', attachment.file);
          formData.append('purpose', 'general');
          formData.append('skipTemp', 'true'); // Skip temp storage and go straight to permanent
          
          // Upload and finalize the file
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error('Failed to upload file: ' + (errorData.error || 'Unknown error'));
          }
          
          const data = await response.json();
          
          // Return the uploaded file data
          return {
            url: data.url,
            type: attachment.type,
            size: attachment.size,
            name: data.originalFilename || attachment.name,
            isCompressed: !data.compressionFailed
          };
        }
      });
      
      // Wait for all finalizations to complete
      const finalizedAttachments = (await Promise.all(finalizePromises))
        .filter(Boolean) as MessageAttachment[];
        
      // Track the filenames of attachments that have been finalized and sent
      // so we don't clean them up later
      const newSentFilenames = attachments
        .filter(att => att.tempFilename)
        .map(att => att.tempFilename as string);
        
      // Update the list of sent attachment filenames
      setSentAttachmentFilenames(prev => [...prev, ...newSentFilenames]);
      console.log('Tracking sent attachment filenames:', newSentFilenames);
      
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
        attachments: finalizedAttachments,
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
        attachments: finalizedAttachments,
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
    const isProcessing = attachment.isProcessing;
    const isVirusDetected = attachment.isVirusDetected;
    
    // Force React to re-render this component when processing state changes
    const processingState = processingAttachments[attachment.id];
    
    console.log(`Rendering attachment ${attachment.id}:`, {
      isProcessing,
      processingState,
      isVirusDetected,
      url: attachment.url,
      name: attachment.name
    });
    
    return (
      <div key={index} className="relative group">
        <div className={`border rounded-md p-2 flex items-center space-x-2 ${isVirusDetected ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-800'}`}>
          {isImage ? (
            <div className="relative h-12 w-12 overflow-hidden rounded">
              <img
                src={attachment.url}
                alt={attachment.name || 'Image attachment'}
                className={`object-cover h-full w-full ${isProcessing ? 'opacity-50' : ''}`}
              />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-12 w-12 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded">
              <File size={24} className={`${isVirusDetected ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`} />
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isVirusDetected ? 'text-red-600 dark:text-red-400' : ''}`}>
              {attachment.name || (isImage ? 'Image' : 'File')}
              {isVirusDetected && " (Virus Detected)"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(attachment.size / 1024)} KB
              {isProcessing && " • Processing..."}
              {attachment.isCompressed && " • Compressed"}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => removeAttachment(index)}
            // Allow removing even during processing
            disabled={false}
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
                  <span className="ml-1 message-status">
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
            {/* Simple file input element with hidden visibility */}
            <input
              type="file"
              id="file-upload"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*"
              style={{ display: 'none' }}
              multiple
            />
            
            {/* Attachment button that triggers the file input */}
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                console.log('Attachment button clicked');
                
                // Create a new file input element and trigger it directly
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'image/*,video/*';
                
                // Add the event listener before clicking
                input.addEventListener('change', (event) => {
                  console.log('File input change event triggered');
                  const files = (event.target as HTMLInputElement).files;
                  
                  if (!files || files.length === 0) {
                    console.log('No files selected in dynamic input');
                    return;
                  }
                  
                  console.log(`Dynamic input: ${files.length} files selected`);
                  
                  // Convert files to attachments with loading state
                  const newAttachments: MessageAttachment[] = [];
                  
                  // Process each file
                  for (const file of Array.from(files)) {
                    // Check file size (limit to 10MB)
                    if (file.size > 10 * 1024 * 1024) {
                      toast({
                        title: 'File too large',
                        description: 'Maximum file size is 10MB',
                        variant: 'destructive'
                      });
                      continue;
                    }
                    
                    console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
                    
                    // Create a temporary URL for preview
                    const url = URL.createObjectURL(file);
                    const attachmentId = crypto.randomUUID();
                    
                    // Add to attachments with loading state
                    const newAttachment: MessageAttachment = {
                      id: attachmentId,
                      url,
                      type: file.type,
                      size: file.size,
                      name: file.name,
                      file, // Keep the original file for upload
                      isVirusDetected: false, // Default to false until scanned
                      isProcessing: true // Set to true while scanning/processing
                    };
                    
                    newAttachments.push(newAttachment);
                    
                    // Update the processing state tracking
                    setProcessingAttachments(prev => {
                      const updated = { ...prev, [attachmentId]: true };
                      console.log(`Updated processing states for ${attachmentId}:`, updated);
                      return updated;
                    });
                  }
                  
                  // Add all attachments to state
                  setAttachments(prev => {
                    const updated = [...prev, ...newAttachments];
                    console.log('Updated attachments array with new attachments:', updated);
                    return updated;
                  });
                  
                  // Process each file after adding to state
                  for (const attachment of newAttachments) {
                    processAttachment(attachment);
                  }
                });
                
                // Trigger the file selection dialog
                input.click();
              }}
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
