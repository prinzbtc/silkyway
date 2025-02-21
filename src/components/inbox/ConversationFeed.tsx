'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Check, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import type { Conversation } from '@/types/conversation';
import { formatPrice, formatSOL, getSolPrice } from '@/lib/price';
import ListingBanner from './ListingBanner';
import MessageBubble from './MessageBubble';
import OfferCard from './OfferCard';
import ProposePrice from './ProposePrice';

interface ConversationFeedProps {
  conversation: Conversation;
  userId: string;
}

const MAX_MESSAGE_LENGTH = 350;
const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

export default function ConversationFeed({
  conversation,
  userId,
}: ConversationFeedProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isProposePriceOpen, setIsProposePriceOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBuyer = conversation.buyer.id === userId;

  // Create preview URLs for selected images
  const imagePreviews = images.map(file => ({
    url: URL.createObjectURL(file),
    name: file.name
  }));

  // Cleanup preview URLs when images change
  useEffect(() => {
    return () => {
      imagePreviews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, [images]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [conversation.messages]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Validate number of images
    if (files.length > MAX_IMAGES) {
      toast({
        title: 'Too many images',
        description: `You can only upload ${MAX_IMAGES} images at a time`,
        variant: 'destructive',
      });
      return;
    }

    // Validate each image
    const validFiles = files.filter((file) => {
      // Check file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported image type`,
          variant: 'destructive',
        });
        return false;
      }

      // Check file size
      if (file.size > MAX_IMAGE_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 3MB limit`,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    });

    setImages(validFiles);
  };

  const handleSendMessage = async () => {
    if (!message.trim() && images.length === 0) return;

    if (message.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: 'Message too long',
        description: `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // First upload images if any
      let attachments: { url: string; type: string; size: number; }[] = [];
      if (images.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        
        const formData = new FormData();
        images.forEach((image) => formData.append('files', image));

        try {
          const response = await fetch('/api/[type]/files/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Failed to upload images');
          
          const data = await response.json();
          attachments = data.files.map((file: { url: string; type: string; size: number }) => ({
            url: file.url,
            type: file.type,
            size: file.size,
          }));
          
          setUploadProgress(100);
        } catch (error) {
          toast({
            title: 'Upload failed',
            description: 'Failed to upload one or more images',
            variant: 'destructive',
          });
          return;
        } finally {
          setIsUploading(false);
        }
      }

      // Then send message
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message.trim(),
          attachments,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Clear input
      setMessage('');
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const removeImage = (index: number) => {
    setImages(current => current.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Listing Banner */}
      <ListingBanner listing={conversation.listing} />

      {/* Message Feed */}
      <div
        ref={feedRef}
        className="flex-1 space-y-4 overflow-y-auto p-4"
      >
        {conversation.messages.map((message: any) => (
          <MessageBubble
            key={message.id}
            message={message}
            isSender={message.senderId === userId}
          />
        ))}
        {conversation.offers.map((offer: any) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            listing={conversation.listing}
            isBuyer={isBuyer}
          />
        ))}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="space-y-4">
          {/* Image Previews */}
          {images.length > 0 && (
            <div className="flex gap-2">
              {images.map((file, index) => (
                <div key={index} className="relative h-16 w-16">
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="rounded object-cover"
                  />
                  <button
                    onClick={() => setImages(images.filter((_, i) => i !== index))}
                    className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <EmojiPicker
              onEmojiSelect={(emoji) => setMessage((prev) => prev + emoji)}
            />
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1"
            />
            {isBuyer && (
              <Button
                variant="outline"
                onClick={() => setIsProposePriceOpen(true)}
              >
                Make an offer
              </Button>
            )}
            <Button onClick={handleSendMessage}>Send</Button>
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
        listing={conversation.listing}
        conversationId={conversation.id}
      />
    </>
  );
}
