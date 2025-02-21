'use client';

import { getSession } from '@/lib/auth/session';
import Image from 'next/image';
import { Message } from '@/types/chat';
import { useEffect, useState } from 'react';
import { TransactionNotisCard } from '@/components/notifications/TransactionNotisCard';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: Message;
  className?: string;
}

export function ChatMessage({ message, className }: ChatMessageProps) {
  const [session, setSession] = useState<Awaited<ReturnType<typeof getSession>> | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);
  const isCurrentUser = message.senderId === session?.user?.id;

  if (message.type === 'transaction_notification') {
    const metadata = message.metadata as {
      type: 'buyer' | 'seller' | 'buyerCancel' | 'sellerCancel';
      listingTitle: string;
      counterpartyUsername: string;
      transactionId: string;
    };

    // Only show transaction notifications to the intended recipient
    const shouldShow = (
      (metadata.type.startsWith('buyer') && !isCurrentUser) || // Show buyer cards to buyers
      (metadata.type.startsWith('seller') && isCurrentUser)    // Show seller cards to sellers
    );

    if (!shouldShow) return null;

    return (
      <TransactionNotisCard
        type={metadata.type}
        listingTitle={metadata.listingTitle}
        counterpartyUsername={metadata.counterpartyUsername}
        transactionId={metadata.transactionId}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex w-full',
        isCurrentUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-4 py-2 space-y-2',
          isCurrentUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <div>{message.content}</div>
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <div key={index} className="relative w-32 h-32">
                {attachment.type.startsWith('image/') ? (
                  <Image
                    src={attachment.url}
                    alt="Attached image"
                    fill
                    className="object-cover rounded-md"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full border rounded-md">
                    <span className="text-sm">{attachment.type}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
