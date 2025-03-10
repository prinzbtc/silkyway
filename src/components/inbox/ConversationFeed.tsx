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
import ListingBanner from './ListingBanner';
import MessageBubble from './MessageBubble';
import OfferCard from './OfferCard';
import ProposePrice from './ProposePrice';

interface ConversationFeedProps {
  conversation: Conversation;
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
  conversation,
  userId,
}: ConversationFeedProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
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

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [conversation.messages]);

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

      // Then send message
      const messageData: SendMessageInput = {
        content: message.trim(),
        attachments: messageAttachments,
      };
      
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${errorText}`);
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
          <ListingBanner listing={conversation.listing} />
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
        
        {conversation.messages.map((message: any) => (
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
