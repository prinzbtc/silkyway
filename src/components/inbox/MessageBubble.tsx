'use client';

import { useState } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Check, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { Message, MessageAttachment } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
  isSender: boolean;
}

export default function MessageBubble({ message, isSender }: MessageBubbleProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDeleteImage = async (imageUrl: string) => {
    try {
      const response = await fetch(`/api/messages/${message.id}/attachments`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) throw new Error('Failed to delete image');
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  return (
    <div
      className={cn(
        'flex gap-2',
        isSender ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="relative h-8 w-8 shrink-0">
        <Image
          src={message.sender.avatar || '/images/default-avatar.png'}
          alt={message.sender.username || 'Anonymous'}
          fill
          className="rounded-full object-cover"
        />
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'group max-w-[70%] space-y-1',
          isSender ? 'items-end' : 'items-start'
        )}
      >
        {/* Username and Date */}
        <div
          className={cn(
            'flex items-baseline gap-2 text-sm',
            isSender ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="font-medium">
            {message.sender.username || 'Anon'}
          </span>
          <span className="text-xs text-gray-500">
            {format(new Date(message.createdAt), 'MMM yyyy')}
          </span>
          {isSender && message.read && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </div>

        {/* Text Content */}
        {message.content && (
          <div
            className={cn(
              'rounded-lg px-4 py-2',
              isSender
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-accent-foreground'
            )}
          >
            {message.content}
          </div>
        )}

        {/* Images */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments
              .filter(attachment => attachment.type.startsWith('image/'))
              .map((attachment, index) => (
              <div key={index} className="relative">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="relative h-32 w-32 overflow-hidden rounded-lg">
                      <Image
                        src={attachment.url}
                        alt={`Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <div className="relative h-[80vh]">
                      <Image
                        src={attachment.url}
                        alt={`Image ${index + 1}`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Delete Image Button (only for sender) */}
                {isSender && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 shadow transition-opacity group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteImage(attachment.url)}
                      >
                        Delete Image
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
